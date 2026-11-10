"""Salida independiente y ejecución real opcional en PostgreSQL aislado."""

import os
import uuid
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient

from app.core.canonical_model.class_model import UMLAttribute, UMLClass
from app.core.canonical_model.model import UMLModel
from app.core.canonical_model.relationship_model import UMLRelationship
from app.main import app
from app.modules.generator.application.generate_project import ProjectGenerator
from app.modules.generator.application.generate_sql import generate_sql
from app.modules.generator.domain.exceptions import GenerationError
from app.modules.generator.domain.field_info import FieldInfo
from app.modules.generator.domain.sql_values import constrained_value

TEMPLATES = Path(__file__).resolve().parents[2] / "app/modules/generator/templates"


def entity(name, id_type="Long", attributes=None):
    return UMLClass(
        id=str(uuid.uuid5(uuid.NAMESPACE_DNS, name)),
        name=name,
        attributes=[
            UMLAttribute(
                id=str(uuid.uuid4()), name="id", type=id_type, is_primary_key=True
            ),
            *(attributes or []),
        ],
    )


def attribute(name, kind="String", **kwargs):
    return UMLAttribute(id=str(uuid.uuid4()), name=name, type=kind, **kwargs)


def relation(source, target, source_mult="1", target_mult="*", kind="association"):
    return UMLRelationship(
        id=str(uuid.uuid4()),
        source=source.id,
        target=target.id,
        type=kind,
        source_multiplicity=source_mult,
        target_multiplicity=target_mult,
    )


def model_for(case):
    if case == "inheritance":
        parent, child = entity("Persona", "UUID"), entity("Alumno")
        return UMLModel(
            id="sql-test",
            classes=[child, parent],
            relationships=[relation(child, parent, kind="generalization")],
        )
    if case == "types":
        attrs = [
            attribute("nombre", min_length=3, max_length=8),
            attribute("order"),
            attribute("references"),
            attribute("edad", "Integer", min_value=0, max_value=2),
            attribute("saldo", "Decimal", min_value=1.25, max_value=1.26),
            attribute("fecha", "DateTime"),
            attribute("hora", "Time"),
            attribute("activo", "Boolean"),
            attribute("codigo", "UUID"),
            attribute("foto", "bytea"),
            attribute("peso", "Float"),
            attribute("nivel", "Short"),
        ]
        return UMLModel(id="sql-test", classes=[entity("Registro", attributes=attrs)])
    a, b = entity("Cliente"), entity("Pedido", "UUID")
    if case == "many":
        rels = [relation(a, b)]
    elif case == "one":
        rels = [relation(a, b, "0..1", "1")]
    elif case == "join":
        rels = [relation(a, b, "*", "*")]
    elif case == "cycle":
        rels = [relation(a, b, "0..1", "0..1"), relation(b, a, "0..1", "0..1")]
    elif case == "hard-cycle":
        rels = [relation(a, b, "1", "1"), relation(b, a, "1", "1")]
    elif case == "self":
        return UMLModel(
            id="sql-test", classes=[a], relationships=[relation(a, a, "0..1", "*")]
        )
    else:
        raise AssertionError(case)
    return UMLModel(id="sql-test", classes=[a, b], relationships=rels)


def files_for(model, rows=7):
    content, filename, media = generate_sql(model, "both", rows, TEMPLATES)
    assert filename == "database.zip" and media == "application/zip"
    with ZipFile(BytesIO(content)) as archive:
        assert set(archive.namelist()) == {"schema.sql", "data.sql", "README.txt"}
        return {n: archive.read(n).decode() for n in archive.namelist()}


@pytest.mark.parametrize(
    "mode,filename", [("schema", "schema.sql"), ("data", "data.sql")]
)
def test_single_download(mode, filename):
    content, name, media = generate_sql(model_for("many"), mode, 3, TEMPLATES)
    assert name == filename and media == "application/sql"
    assert ("CREATE TABLE" in content.decode()) == (mode == "schema")
    assert ("INSERT INTO" in content.decode()) == (mode == "data")


@pytest.mark.parametrize(
    "case", ["many", "one", "join", "self", "cycle", "inheritance", "types"]
)
def test_export_deterministic_and_complete(case):
    model = model_for(case)
    files = files_for(model)
    assert files == files_for(model)
    if "ALTER TABLE" in files["schema.sql"]:
        assert files["schema.sql"].rfind("CREATE TABLE") < files["schema.sql"].find(
            "ALTER TABLE"
        )
    assert files["data.sql"].count("INSERT INTO") >= 7
    if case == "cycle":
        assert "UPDATE " in files["data.sql"]
    if case == "one":
        assert "UNIQUE" in files["schema.sql"]
    if case == "inheritance":
        assert "id UUID PRIMARY KEY" in files["schema.sql"]
        assert "BIGSERIAL" not in files["schema.sql"]


def test_schema_can_export_hard_cycle_without_data():
    model = model_for("hard-cycle")
    assert b"CREATE TABLE" in generate_sql(model, "schema", 3, TEMPLATES)[0]
    with pytest.raises(GenerationError, match="SEED_CYCLE_DETECTED"):
        files_for(model)


def test_sql_string_escaping():
    field = FieldInfo(name="nombre", java_type="String", sql_type="TEXT")
    assert constrained_value(field, "'O'Brien\\ruta'") == "'O''Brien\\ruta'"


@pytest.mark.parametrize(
    "kwargs", [{"min_length": 8, "max_length": 2}, {"min_length": -1}]
)
def test_invalid_lengths(kwargs):
    model = UMLModel(
        id="invalid",
        classes=[entity("Registro", attributes=[attribute("nombre", **kwargs)])],
    )
    with pytest.raises(GenerationError, match="Longitudes incompatibles"):
        files_for(model)


def test_invalid_integer_interval():
    model = UMLModel(
        id="invalid",
        classes=[
            entity(
                "Registro",
                attributes=[
                    attribute("nivel", "Integer", min_value=0.2, max_value=0.8)
                ],
            )
        ],
    )
    with pytest.raises(GenerationError, match="Límites incompatibles"):
        files_for(model)


def test_spring_and_sql_share_schema_and_seed():
    model = model_for("many")
    sql = files_for(model, rows=3)
    project = ProjectGenerator(TEMPLATES).generate(model, "demo", "com.example.demo")
    output = {file.path: file.content for file in project.files}
    assert output["src/main/resources/schema.sql"] == sql["schema.sql"]
    for line in sql["data.sql"].splitlines():
        if line.startswith(("INSERT", "UPDATE", "SELECT")):
            assert line in output["src/main/resources/data.sql"]


@pytest.mark.parametrize("rows", [0, 1001, 1.5, True])
def test_api_rejects_invalid_counts(rows):
    response = TestClient(app).post(
        "/api/v1/models/generate-sql",
        json={
            "model_data": model_for("many").model_dump(mode="json"),
            "rows_per_entity": rows,
        },
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "mode,expected",
    [
        ("schema", "application/sql"),
        ("data", "application/sql"),
        ("both", "application/zip"),
    ],
)
def test_api_download(mode, expected):
    response = TestClient(app).post(
        "/api/v1/models/generate-sql",
        json={"model_data": model_for("many").model_dump(mode="json"), "mode": mode},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(expected)
    assert "attachment" in response.headers["content-disposition"]


@pytest.mark.parametrize(
    "data",
    [
        {"id": "empty"},
        {"id": "bad", "classes": [{"name": "X", "attributes": [{"name": "dato"}]}]},
        {
            "id": "component",
            "components": [{"id": str(uuid.uuid4()), "name": "Servicio"}],
        },
    ],
)
def test_api_invalid_model(data):
    response = TestClient(app).post(
        "/api/v1/models/generate-sql", json={"model_data": data}
    )
    assert response.status_code == 422


@pytest.fixture
def postgres():
    dsn = os.environ.get("UMLFORGE_TEST_POSTGRES_DSN")
    if not dsn:
        pytest.skip(
            "Definir UMLFORGE_TEST_POSTGRES_DSN para verificar con PostgreSQL real."
        )
    import psycopg2
    from psycopg2 import sql

    connection = psycopg2.connect(dsn)
    connection.autocommit = True
    schema = "sql_test_" + uuid.uuid4().hex
    with connection.cursor() as cursor:
        cursor.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        cursor.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
    try:
        yield connection
    finally:
        with connection.cursor() as cursor:
            cursor.execute("ROLLBACK")
            cursor.execute(
                sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema))
            )
        connection.close()


@pytest.mark.parametrize(
    "case", ["many", "one", "join", "self", "cycle", "inheritance", "types"]
)
@pytest.mark.parametrize("rows", [1, 7])
def test_execute_in_postgres(postgres, case, rows):
    from psycopg2 import sql

    from app.modules.generator.domain.entity_mapper import EntityMapper

    model = model_for(case)
    files = files_for(model, rows)
    with postgres.cursor() as cursor:
        cursor.execute(files["schema.sql"])
        cursor.execute(files["data.sql"])
        # La inicialización Spring debe tolerar reinicios sin duplicar restricciones.
        cursor.execute(files["schema.sql"])
        cursor.execute(files["data.sql"])
        for ent in EntityMapper.map_entities(model):
            cursor.execute(
                sql.SQL("SELECT count(*) FROM {}").format(
                    sql.Identifier(ent.table_name)
                )
            )
            assert cursor.fetchone()[0] == rows
        if case == "many":
            cursor.execute("INSERT INTO clientes DEFAULT VALUES RETURNING id")
            assert cursor.fetchone()[0] == rows + 1
        if case == "join":
            cursor.execute("SELECT count(*) FROM clientes_pedidos")
            assert cursor.fetchone()[0] >= rows
        if case == "types":
            cursor.execute(
                "SELECT min(edad), max(edad), min(char_length(nombre)), max(char_length(nombre)) FROM registros"
            )
            lo, hi, shortest, longest = cursor.fetchone()
            assert 0 <= lo <= hi <= 2 and 3 <= shortest <= longest <= 8


def test_api_rejects_unknown_mode_and_hard_cycles():
    client = TestClient(app)
    payload = {
        "model_data": model_for("many").model_dump(mode="json"),
        "mode": "invalid",
    }
    assert client.post("/api/v1/models/generate-sql", json=payload).status_code == 422
    payload = {"model_data": model_for("hard-cycle").model_dump(mode="json")}
    response = client.post("/api/v1/models/generate-sql", json=payload)
    assert response.status_code == 422
    assert "SEED_CYCLE_DETECTED" in response.json()["detail"]


def test_primary_keys_must_fit_declared_constraints():
    bounded = entity("Registro")
    bounded.attributes[0].max_value = 2
    model = UMLModel(id="bounded", classes=[bounded])
    with pytest.raises(GenerationError, match="No caben"):
        files_for(model, 3)
    bounded.attributes[0].max_value = 1000
    assert files_for(model, 1000)["data.sql"].count("INSERT INTO registros") == 1000


def test_rejects_composite_entity_keys():
    record = entity("Registro", attributes=[attribute("codigo", is_primary_key=True)])
    with pytest.raises(GenerationError, match="claves compuestas"):
        files_for(UMLModel(id="composite", classes=[record]))


def test_postgres_escaped_literal(postgres):
    field = FieldInfo(name="nombre", java_type="String", sql_type="TEXT")
    with postgres.cursor() as cursor:
        cursor.execute("SET standard_conforming_strings = on")
        cursor.execute("SELECT " + constrained_value(field, "'O’Brien O'Connor\\ruta'"))
        assert cursor.fetchone()[0] == "O’Brien O'Connor\\ruta"


def test_nonpositive_primary_key_sequence(postgres):
    record = entity("Registro")
    record.attributes[0].max_value = 0
    files = files_for(UMLModel(id="nonpositive", classes=[record]), rows=1)
    with postgres.cursor() as cursor:
        cursor.execute(files["schema.sql"])
        cursor.execute(files["data.sql"])
        cursor.execute("SELECT id FROM registros")
        assert cursor.fetchone()[0] == 0
