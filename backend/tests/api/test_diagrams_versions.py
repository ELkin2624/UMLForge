"""CRUD de diagramas en el almacén NoSQL + historial de versiones."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database.models import Base, DiagramPermission, User
from app.core.database.session import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # No usar "with": evita el lifespan (que toca PostgreSQL real).
    # Las demás overrides (repo en memoria) las pone tests/conftest.py.
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


def _user(db, name):
    u = User(
        email=f"{name}@t.com", username=name, display_name=name.capitalize(),
        password_hash=get_password_hash("x"), is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _h(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user.id)})}"}


def _model(*names):
    return {"classes": [
        {"id": n, "name": n, "attributes": [], "operations": []} for n in names
    ], "relationships": []}


@pytest.fixture
def world(client, db_session):
    owner, editor, reader = (_user(db_session, n) for n in ("alice", "bob", "carol"))
    res = client.post("/api/v1/diagrams", json={"name": "D", "data": _model()}, headers=_h(owner))
    assert res.status_code == 200, res.text
    diagram_id = res.json()["id"]
    db_session.add_all([
        DiagramPermission(diagram_id=diagram_id, user_id=editor.id, role="EDITOR"),
        DiagramPermission(diagram_id=diagram_id, user_id=reader.id, role="READER"),
    ])
    db_session.commit()
    return {"id": diagram_id, "owner": _h(owner), "editor": _h(editor), "reader": _h(reader)}


def _put(client, w, who, data, **extra):
    return client.put(
        f"/api/v1/diagrams/{w['id']}", json={"data": data, "expected_revision":client.get(f"/api/v1/diagrams/{w['id']}", headers=w[who]).json().get("version", 1), **extra}, headers=w[who]
    )


def test_crear_registra_version_1(client, world):
    res = client.get(f"/api/v1/diagrams/{world['id']}/versions", headers=world["owner"])
    assert res.status_code == 200
    versions = res.json()
    assert len(versions) == 1 and versions[0]["version"] == 1
    assert versions[0]["author"]["name"] == "Alice"


def test_guardar_crea_version_y_devuelve_data(client, world):
    res = _put(client, world, "owner", _model("A"))
    assert res.status_code == 200
    body = res.json()
    assert body["version"] == 2 and body["version_created"] is True
    assert body["data"] == _model("A") and body["my_role"] == "OWNER"
    assert client.get(f"/api/v1/diagrams/{world['id']}", headers=world["owner"]).json()["data"] == _model("A")


def test_guardar_igual_no_crea_version(client, world):
    _put(client, world, "owner", _model("A"))
    res = _put(client, world, "owner", _model("A"))
    assert res.json()["version_created"] is False and res.json()["version"] == 2


def test_atribucion_por_usuario(client, world):
    _put(client, world, "owner", _model("A"))
    _put(client, world, "editor", _model("A", "B"))
    versions = client.get(f"/api/v1/diagrams/{world['id']}/versions", headers=world["reader"]).json()
    assert [(v["version"], v["author"]["name"]) for v in versions] == [(3, "Bob"), (2, "Alice"), (1, "Alice")]
    assert "Agregó clase B" in versions[0]["summary"]
    assert versions[0]["changes"][0]["op"] == "added"


def test_autor_ia(client, world):
    res = _put(client, world, "editor", _model("MetodoPago"), source="ai")
    assert res.status_code == 200
    v = client.get(f"/api/v1/diagrams/{world['id']}/versions", headers=world["owner"]).json()[0]
    assert v["author"]["type"] == "ai" and v["author"]["on_behalf_of"]["name"] == "Bob"
    assert v["source"] == "ai"


def test_origen_invalido_rechazado(client, world):
    assert _put(client, world, "owner", _model("A"), source="hack").status_code == 422


def test_reader_no_puede_guardar(client, world):
    assert _put(client, world, "reader", _model("A")).status_code == 403


def test_ver_version_y_404(client, world):
    _put(client, world, "owner", _model("A"))
    ok = client.get(f"/api/v1/diagrams/{world['id']}/versions/1", headers=world["reader"])
    assert ok.status_code == 200 and ok.json()["data"] == _model()
    assert client.get(f"/api/v1/diagrams/{world['id']}/versions/99", headers=world["reader"]).status_code == 404


def test_restaurar_crea_version_nueva_y_conserva_historial(client, world):
    _put(client, world, "owner", _model("A"))
    _put(client, world, "owner", _model("A", "B"))
    res = client.post(f"/api/v1/diagrams/{world['id']}/versions/2/restore", json={"expected_revision":3}, headers=world["editor"])
    assert res.status_code == 200
    body = res.json()
    assert body["version"] == 4 and body["data"] == _model("A")
    versions = client.get(f"/api/v1/diagrams/{world['id']}/versions", headers=world["owner"]).json()
    assert [v["version"] for v in versions] == [4, 3, 2, 1]
    assert versions[0]["source"] == "restore" and versions[0]["restored_from"] == 2
    assert versions[0]["author"]["name"] == "Bob"


def test_reader_no_puede_restaurar(client, world):
    _put(client, world, "owner", _model("A"))
    res = client.post(f"/api/v1/diagrams/{world['id']}/versions/1/restore", headers=world["reader"])
    assert res.status_code == 403


def test_sin_acceso_no_ve_historial(client, world, db_session):
    stranger = _user(db_session, "mallory")
    res = client.get(f"/api/v1/diagrams/{world['id']}/versions", headers=_h(stranger))
    assert res.status_code == 403


def test_borrar_elimina_documento_e_historial(client, world, diagram_repo):
    assert client.delete(f"/api/v1/diagrams/{world['id']}", headers=world["editor"]).status_code == 403
    assert client.delete(f"/api/v1/diagrams/{world['id']}", headers=world["owner"]).status_code == 204
    assert not diagram_repo.has_document(world["id"])
    assert diagram_repo.list_versions(world["id"]) == []


def test_registro_crea_documento_inicial(client, diagram_repo):
    res = client.post("/api/v1/auth/register", json={
        "username": "newbie", "email": "n@t.com", "password": "Password123!",
    })
    assert res.status_code == 200, res.text
    assert any(diagram_repo.has_document(i) for i in range(1, 5))


def test_mongo_caido_responde_503(client, world):
    from pymongo.errors import ServerSelectionTimeoutError

    from app.core.dependencies import get_diagram_repo
    from app.modules.diagram_store import InMemoryDiagramRepository

    class Broken(InMemoryDiagramRepository):
        def _get_document(self, diagram_id):
            raise ServerSelectionTimeoutError("sin conexión")

        def current_version(self, diagram_id):
            raise ServerSelectionTimeoutError("sin conexión")

        def get_data(self, diagram_id):
            raise ServerSelectionTimeoutError("sin conexión")

    app.dependency_overrides[get_diagram_repo] = lambda: Broken()
    res = client.get(f"/api/v1/diagrams/{world['id']}", headers=world["owner"])
    assert res.status_code == 503
    assert res.json()["code"] == "STORE_UNAVAILABLE"


@pytest.fixture(autouse=True)
def coordinator_engine(monkeypatch):
    from app.modules.collaboration.service import Coordinator
    from tests.command_engine import engine
    monkeypatch.setattr(Coordinator, "engine", engine)
