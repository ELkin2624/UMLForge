import secrets
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database.models import User, Diagram, DiagramPermission, RefreshToken
from app.core.security import get_password_hash, get_token_hash, verify_token_hash, create_access_token, create_refresh_token, verify_password
from app.modules.auth.schemas import UserCreate, UserLogin
from app.core.errors import APIError

def create_initial_diagram(db: Session, user: User):
    empty_diagram_data = {
        "classes": [],
        "associations": [],
        "generalizations": [],
        "interfaces": [],
        "realizations": [],
        "dependencies": [],
        "packages": [],
        "components": [],
        "ports": [],
        "connectors": [],
    }
    diagram = Diagram(
        name=f"Diagrama de {user.username}",
        data=empty_diagram_data,
        owner_id=user.id
    )
    db.add(diagram)
    db.flush() # Para obtener el ID del diagrama
    
    permission = DiagramPermission(
        diagram_id=diagram.id,
        user_id=user.id,
        role="OWNER"
    )
    db.add(permission)

def register_user(db: Session, user_in: UserCreate) -> User:
    # Verificar si email o username ya existen
    existing = db.query(User).filter(
        or_(User.email == user_in.email, User.username == user_in.username)
    ).first()
    if existing:
        raise APIError(status_code=400, message="Email o username ya están en uso.")

    db_user = User(
        email=user_in.email,
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        display_name=user_in.display_name or user_in.username
    )
    db.add(db_user)
    db.flush() # para obtener db_user.id
    
    create_initial_diagram(db, db_user)
    
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, login_data: UserLogin) -> User:
    user = db.query(User).filter(
        or_(User.email == login_data.identifier, User.username == login_data.identifier)
    ).first()
    if not user:
        return None
    if not user.password_hash or not verify_password(login_data.password, user.password_hash):
        return None
    return user

def create_session_for_user(db: Session, user: User) -> tuple[str, str]:
    access_token = create_access_token(data={"sub": str(user.id), "username": user.username})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "username": user.username})
    
    db_refresh = RefreshToken(
        user_id=user.id,
        token_hash=get_token_hash(refresh_token), # almacenamos el hash SHA-256
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7) # 7 días, hardcodeado o leer settings
    )
    db.add(db_refresh)
    db.commit()
    
    return access_token, refresh_token

def rotate_refresh_token(db: Session, old_token: str, user_id: int) -> tuple[str, str]:
    tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at == None
    ).all()
    
    db_token = None
    for t in tokens:
        if verify_token_hash(old_token, t.token_hash):
            db_token = t
            break
            
    if not db_token:
        raise APIError(status_code=401, message="Refresh token inválido o ya revocado.")
        
    if db_token.expires_at < datetime.datetime.utcnow():
        raise APIError(status_code=401, message="Refresh token expirado.")
        
    # Revocamos el actual
    db_token.revoked_at = datetime.datetime.utcnow()
    
    # Creamos nuevos
    user = db.get(User, user_id)
    access_token = create_access_token(data={"sub": str(user.id), "username": user.username})

    new_refresh_token = create_refresh_token(data={"sub": str(user.id), "username": user.username})
    
    new_db_refresh = RefreshToken(
        user_id=user.id,
        token_hash=get_token_hash(new_refresh_token),
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
        rotated_from=str(db_token.id)
    )
    db.add(new_db_refresh)
    db.commit()
    
    return access_token, new_refresh_token

def revoke_token(db: Session, token: str, user_id: int):
    tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at == None
    ).all()
    for t in tokens:
        if verify_token_hash(token, t.token_hash):
            t.revoked_at = datetime.datetime.utcnow()
            db.commit()
            return
