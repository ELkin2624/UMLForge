import pytest
from app.modules.generator.domain.entity_info import EntityInfo
from app.modules.generator.domain.field_info import FieldInfo
from app.modules.generator.domain.relation_info import RelationInfo
from app.modules.generator.domain.mobile_schema_mapper import MobileSchemaMapper
from app.modules.generator.domain.ai_tools_mapper import AIToolsMapper
from app.modules.generator.domain.manifest_mapper import ManifestMapper


@pytest.fixture
def sample_entities():
    cliente = EntityInfo(
        class_name="Cliente",
        table_name="clientes",
        resource_path="/api/clientes",
        id_field=FieldInfo(name="id", java_type="Long", sql_type="BIGINT", is_primary_key=True),
        fields=[
            FieldInfo(name="nombre", java_type="String", sql_type="VARCHAR(255)", is_nullable=False),
            FieldInfo(name="telefono", java_type="String", sql_type="VARCHAR(50)", is_nullable=True),
        ],
        relations=[],
    )

    barbero = EntityInfo(
        class_name="Barbero",
        table_name="barberos",
        resource_path="/api/barberos",
        id_field=FieldInfo(name="id", java_type="Long", sql_type="BIGINT", is_primary_key=True),
        fields=[
            FieldInfo(name="nombre", java_type="String", sql_type="VARCHAR(255)", is_nullable=False),
            FieldInfo(name="especialidad", java_type="String", sql_type="VARCHAR(100)", is_nullable=True),
        ],
        relations=[],
    )

    corte = EntityInfo(
        class_name="Corte",
        table_name="cortes",
        resource_path="/api/cortes",
        id_field=FieldInfo(name="id", java_type="Long", sql_type="BIGINT", is_primary_key=True),
        fields=[
            FieldInfo(name="nombre", java_type="String", sql_type="VARCHAR(255)", is_nullable=False),
            FieldInfo(name="precio", java_type="Double", sql_type="NUMERIC(10,2)", is_nullable=False),
        ],
        relations=[],
    )

    cita = EntityInfo(
        class_name="Cita",
        table_name="citas",
        resource_path="/api/citas",
        id_field=FieldInfo(name="id", java_type="Long", sql_type="BIGINT", is_primary_key=True),
        fields=[
            FieldInfo(name="fecha_hora", java_type="LocalDateTime", sql_type="TIMESTAMP", is_nullable=False),
        ],
        relations=[
            RelationInfo(
                name="cliente",
                target_entity="Cliente",
                relation_kind="MANY_TO_ONE",
                persistence_owner=True,
                join_column="cliente_id",
            ),
            RelationInfo(
                name="barbero",
                target_entity="Barbero",
                relation_kind="MANY_TO_ONE",
                persistence_owner=True,
                join_column="barbero_id",
            ),
        ],
    )

    return [cliente, barbero, corte, cita]


def test_mobile_schema_mapper(sample_entities):
    schema = MobileSchemaMapper.map_schema("barberia", sample_entities, domain="barberia")
    assert schema.schema_version == "1.0"
    assert schema.project_name == "barberia"
    assert len(schema.entities) == 4

    # Verificar entidad Corte y tipos UI inferidos
    corte_ent = next(e for e in schema.entities if e.name == "Corte")
    assert corte_ent.icon == "scissors"
    precio_field = next(f for f in corte_ent.fields if f.name == "precio")
    assert precio_field.ui_type == "currency"
    assert precio_field.required is True

    # Verificar relaciones en Cita
    cita_ent = next(e for e in schema.entities if e.name == "Cita")
    assert len(cita_ent.relations) == 2
    assert cita_ent.icon == "calendar"


def test_ai_tools_mapper_generates_5_crud_tools_per_entity(sample_entities):
    manifest = AIToolsMapper.map_tools("barberia", sample_entities, domain="barberia")
    assert manifest.schema_version == "1.0"
    # 4 entidades * 5 tools = 20 tools
    assert len(manifest.tools) == 20

    tool_names = [t.name for t in manifest.tools]
    assert "list_cortes" in tool_names
    assert "get_corte_by_id" in tool_names
    assert "create_corte" in tool_names
    assert "update_corte" in tool_names
    assert "delete_corte" in tool_names

    # Validar metadata de create_corte
    create_corte = next(t for t in manifest.tools if t.name == "create_corte")
    assert create_corte.method == "POST"
    assert create_corte.path == "/api/cortes"
    assert create_corte.required_permission == "CREATE_CORTE"
    assert "precio" in create_corte.parameters.properties
    assert "precio" in create_corte.parameters.required


def test_ai_context_mapper(sample_entities):
    context = AIToolsMapper.map_context("barberia", sample_entities, domain="barberia")
    assert context.schema_version == "1.0"
    assert "Barberia" in context.system_prompt
    assert "list_cortes" in context.system_prompt
    assert "Cliente" in context.entities_summary


def test_manifest_mapper():
    manifest = ManifestMapper.map_manifest("barberia_shop", domain="barberia")
    assert manifest.project == "barberia_shop"
    assert manifest.schema_version == "1.0"
    assert manifest.generator_version == "0.8.0"
    assert manifest.ai.model == "qwen2.5-0.5b-instruct"
    assert manifest.branding.primary_color == "#A67917"
