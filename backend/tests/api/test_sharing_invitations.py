import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database.session import get_db
from app.core.database.models import Base, User, Diagram, DiagramPermission, DiagramInvitation, Notification, DiagramRole, InvitationRole, InvitationStatus
from app.core.security import create_access_token, get_password_hash

# Setup in-memory SQLite DB for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def test_users(db_session):
    # Owner user
    owner = User(
        email="owner@umlforge.com",
        username="owner_user",
        display_name="Owner User",
        password_hash=get_password_hash("secret123"),
        is_active=True
    )
    # Target collaborator (Editor/Reader)
    collab = User(
        email="collab@umlforge.com",
        username="collab_user",
        display_name="Collaborator User",
        password_hash=get_password_hash("secret123"),
        is_active=True
    )
    # Reader user
    reader = User(
        email="reader@umlforge.com",
        username="reader_user",
        display_name="Reader User",
        password_hash=get_password_hash("secret123"),
        is_active=True
    )
    # Third party user (no permissions)
    stranger = User(
        email="stranger@umlforge.com",
        username="stranger_user",
        display_name="Stranger User",
        password_hash=get_password_hash("secret123"),
        is_active=True
    )
    db_session.add_all([owner, collab, reader, stranger])
    db_session.commit()
    db_session.refresh(owner)
    db_session.refresh(collab)
    db_session.refresh(reader)
    db_session.refresh(stranger)
    return {
        "owner": owner,
        "collab": collab,
        "reader": reader,
        "stranger": stranger
    }

@pytest.fixture
def auth_headers(test_users):
    return {
        "owner": {"Authorization": f"Bearer {create_access_token({'sub': str(test_users['owner'].id)})}"},
        "collab": {"Authorization": f"Bearer {create_access_token({'sub': str(test_users['collab'].id)})}"},
        "reader": {"Authorization": f"Bearer {create_access_token({'sub': str(test_users['reader'].id)})}"},
        "stranger": {"Authorization": f"Bearer {create_access_token({'sub': str(test_users['stranger'].id)})}"},
    }

@pytest.fixture
def test_diagram(db_session, test_users):
    diagram = Diagram(
        name="Proyecto Ecommerce UML",
        data={"classes": [{"id": "c1", "name": "Producto", "attributes": [], "methods": []}]},
        owner_id=test_users["owner"].id
    )
    db_session.add(diagram)
    db_session.flush()

    permission = DiagramPermission(
        diagram_id=diagram.id,
        user_id=test_users["owner"].id,
        role=DiagramRole.OWNER.value
    )
    db_session.add(permission)
    db_session.commit()
    db_session.refresh(diagram)
    return diagram

# ==================== PRUEBA 1: BÚSQUEDA DE USUARIOS ====================
def test_search_users_privacy_and_filter(client, test_users, auth_headers):
    # Debe requerir JWT
    res_no_auth = client.get("/api/v1/users/search?q=collab")
    assert res_no_auth.status_code == 401

    # Búsqueda con menos de 2 caracteres -> devuelve []
    res_short = client.get("/api/v1/users/search?q=c", headers=auth_headers["owner"])
    assert res_short.status_code == 200
    assert res_short.json() == []

    # Búsqueda válida: No debe exponer emails (privacidad) y debe excluir al usuario autenticado
    res = client.get("/api/v1/users/search?q=collab", headers=auth_headers["owner"])
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == test_users["collab"].id
    assert data[0]["username"] == "collab_user"
    assert data[0]["display_name"] == "Collaborator User"
    assert "email" not in data[0]

# ==================== PRUEBA 2: CREAR INVITACIÓN Y DUPLICADOS ====================
def test_create_invitation_flow_and_conflict(client, test_diagram, test_users, auth_headers, db_session):
    # 1. Propietario invita a 'collab_user' como EDITOR
    invite_payload = {
        "user_id": test_users["collab"].id,
        "role": "EDITOR"
    }
    res = client.post(
        f"/api/v1/diagrams/{test_diagram.id}/invitations",
        json=invite_payload,
        headers=auth_headers["owner"]
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_pending"] is True
    assert data["role"] == "EDITOR"
    assert data["invitation_id"] is not None

    # Verificar que se creó notificación para el invitado
    notif = db_session.query(Notification).filter(
        Notification.recipient_user_id == test_users["collab"].id
    ).first()
    assert notif is not None
    assert notif.type == "DIAGRAM_INVITATION"
    assert notif.read is False
    assert notif.data["invitation_id"] == data["invitation_id"]

    # 2. Intentar invitarlo de nuevo mientras está PENDING -> Debe retornar 409 Conflict
    res_dup = client.post(
        f"/api/v1/diagrams/{test_diagram.id}/invitations",
        json=invite_payload,
        headers=auth_headers["owner"]
    )
    assert res_dup.status_code == 409

# ==================== PRUEBA 3: LISTAR COLABORADORES ====================
def test_get_collaborators(client, test_diagram, test_users, auth_headers):
    # Invitar usuario
    client.post(
        f"/api/v1/diagrams/{test_diagram.id}/invitations",
        json={"user_id": test_users["collab"].id, "role": "EDITOR"},
        headers=auth_headers["owner"]
    )

    res = client.get(f"/api/v1/diagrams/{test_diagram.id}/collaborators", headers=auth_headers["owner"])
    assert res.status_code == 200
    collabs = res.json()
    assert len(collabs) == 2
    # Uno debe ser OWNER y otro PENDING EDITOR
    owner_entry = next(c for c in collabs if c["user_id"] == test_users["owner"].id)
    assert owner_entry["role"] == "OWNER"
    assert owner_entry["is_pending"] is False

    collab_entry = next(c for c in collabs if c["user_id"] == test_users["collab"].id)
    assert collab_entry["role"] == "EDITOR"
    assert collab_entry["is_pending"] is True

# ==================== PRUEBA 4: ACEPTAR INVITACIÓN Y TRANSICIÓN DE ESTADO ====================
def test_accept_invitation_flow(client, test_diagram, test_users, auth_headers, db_session):
    # 1. Crear invitación
    res_inv = client.post(
        f"/api/v1/diagrams/{test_diagram.id}/invitations",
        json={"user_id": test_users["collab"].id, "role": "EDITOR"},
        headers=auth_headers["owner"]
    )
    invitation_id = res_inv.json()["invitation_id"]

    # 2. Un usuario ajeno no puede aceptarla -> 403
    res_stranger = client.post(
        f"/api/v1/invitations/{invitation_id}/accept",
        headers=auth_headers["stranger"]
    )
    assert res_stranger.status_code == 403

    # 3. El invitado la acepta
    res_accept = client.post(
        f"/api/v1/invitations/{invitation_id}/accept",
        headers=auth_headers["collab"]
    )
    assert res_accept.status_code == 200
    accept_data = res_accept.json()
    assert accept_data["success"] is True
    assert accept_data["diagram_id"] == test_diagram.id

    # 4. Verificar que se creó DiagramPermission activo
    perm = db_session.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == test_diagram.id,
        DiagramPermission.user_id == test_users["collab"].id
    ).first()
    assert perm is not None
    assert perm.role == "EDITOR"

    # 5. Verificar que la notificación fue marcada como leída (Item 4)
    notif = db_session.query(Notification).filter(
        Notification.recipient_user_id == test_users["collab"].id
    ).first()
    assert notif.read is True

    # 6. Intentar aceptarla por segunda vez -> 409 Conflict (Item 3)
    res_second = client.post(
        f"/api/v1/invitations/{invitation_id}/accept",
        headers=auth_headers["collab"]
    )
    assert res_second.status_code == 409

# ==================== PRUEBA 5: RECHAZAR INVITACIÓN ====================
def test_reject_invitation_flow(client, test_diagram, test_users, auth_headers, db_session):
    # 1. Crear invitación
    res_inv = client.post(
        f"/api/v1/diagrams/{test_diagram.id}/invitations",
        json={"user_id": test_users["collab"].id, "role": "READER"},
        headers=auth_headers["owner"]
    )
    invitation_id = res_inv.json()["invitation_id"]

    # 2. Rechazar invitación
    res_reject = client.post(
        f"/api/v1/invitations/{invitation_id}/reject",
        headers=auth_headers["collab"]
    )
    assert res_reject.status_code == 200

    # 3. Notificación marcada como leída
    notif = db_session.query(Notification).filter(
        Notification.recipient_user_id == test_users["collab"].id
    ).first()
    assert notif.read is True

    # 4. Verificar que NO tiene permiso en el diagrama
    perm = db_session.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == test_diagram.id,
        DiagramPermission.user_id == test_users["collab"].id
    ).first()
    assert perm is None

    # 5. Intentar aceptar una invitación rechazada -> 409 Conflict
    res_accept_after = client.post(
        f"/api/v1/invitations/{invitation_id}/accept",
        headers=auth_headers["collab"]
    )
    assert res_accept_after.status_code == 409

# ==================== PRUEBA 6: INVARIANTE SINGLE-OWNER Y SEGURIDAD BACKEND ====================
def test_single_owner_invariance_and_rbac(client, test_diagram, test_users, auth_headers, db_session):
    # 1. Owner no puede cambiar su propio rol -> 400
    res_self_role = client.put(
        f"/api/v1/diagrams/{test_diagram.id}/collaborators/{test_users['owner'].id}",
        json={"role": "READER"},
        headers=auth_headers["owner"]
    )
    assert res_self_role.status_code == 400

    # 2. Owner no puede revocarse a sí mismo -> 400
    res_self_revoke = client.delete(
        f"/api/v1/diagrams/{test_diagram.id}/collaborators/{test_users['owner'].id}",
        headers=auth_headers["owner"]
    )
    assert res_self_revoke.status_code == 400

    # 3. Agregar a 'reader_user' como READER activo
    reader_perm = DiagramPermission(
        diagram_id=test_diagram.id,
        user_id=test_users["reader"].id,
        role=DiagramRole.READER.value
    )
    db_session.add(reader_perm)
    db_session.commit()

    # 4. READER intenta hacer GET -> 200 OK
    res_read = client.get(f"/api/v1/diagrams/{test_diagram.id}", headers=auth_headers["reader"])
    assert res_read.status_code == 200

    # 5. READER intenta hacer PUT (modificar diagrama) -> 403 Forbidden (Item 8)
    res_edit = client.put(
        f"/api/v1/diagrams/{test_diagram.id}",
        json={"name": "Hacked Name"},
        headers=auth_headers["reader"]
    )
    assert res_edit.status_code == 403

    # 6. READER intenta hacer DELETE (eliminar diagrama) -> 403 Forbidden
    res_delete = client.delete(
        f"/api/v1/diagrams/{test_diagram.id}",
        headers=auth_headers["reader"]
    )
    assert res_delete.status_code == 403

    # 7. READER intenta invitar o gestionar colaboradores -> 403 Forbidden
    res_invite = client.post(
        f"/api/v1/diagrams/{test_diagram.id}/invitations",
        json={"user_id": test_users["stranger"].id, "role": "EDITOR"},
        headers=auth_headers["reader"]
    )
    assert res_invite.status_code == 403
