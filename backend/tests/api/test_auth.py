import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database.session import get_db
from app.core.database.models import Base, User
from app.core.security import get_password_hash

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

def test_register_and_login_flow(client: TestClient):
    # 1. Register
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": "auth_tester",
            "email": "tester@umlforge.com",
            "password": "Password123!",
            "display_name": "Auth Tester"
        }
    )
    assert reg_res.status_code == 200, reg_res.text
    user_data = reg_res.json()
    assert user_data["username"] == "auth_tester"
    assert user_data["email"] == "tester@umlforge.com"

    # 2. Login returns token AND user profile
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "identifier": "auth_tester",
            "password": "Password123!"
        }
    )
    assert login_res.status_code == 200, login_res.text
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"] is not None
    assert login_data["user"]["username"] == "auth_tester"
    assert login_data["user"]["display_name"] == "Auth Tester"
    assert "refresh_token" in login_res.cookies

    access_token = login_data["access_token"]

    # 3. Access /auth/me with Bearer token
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["username"] == "auth_tester"

    # 4. Refresh token rotates and returns token AND user profile
    refresh_res = client.post("/api/v1/auth/refresh")
    assert refresh_res.status_code == 200, refresh_res.text
    refresh_data = refresh_res.json()
    assert "access_token" in refresh_data
    assert refresh_data["user"] is not None
    assert refresh_data["user"]["username"] == "auth_tester"

    # 5. Logout deletes cookie
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200
    # Cookie should be expired or removed
    assert "refresh_token" not in client.cookies or client.cookies.get("refresh_token") == ""
