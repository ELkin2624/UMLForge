from fastapi import APIRouter, Depends, Response, Cookie
from sqlalchemy.orm import Session
from app.core.database.session import get_db
from app.core.database.models import User
from app.core.auth_deps import get_current_user
from app.core.errors import APIError
from app.core.security import decode_token
from app.modules.auth.schemas import UserCreate, UserLogin, UserResponse, Token
from app.modules.auth.service import register_user, authenticate_user, create_session_for_user, rotate_refresh_token, revoke_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

def set_refresh_cookie(response: Response, refresh_token: str):
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False, # En desarrollo
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    return register_user(db, user_in)

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = authenticate_user(db, login_data)
    if not user:
        raise APIError(status_code=401, message="Credenciales incorrectas.")
    
    access_token, refresh_token = create_session_for_user(db, user)
    set_refresh_cookie(response, refresh_token)
    
    return Token(access_token=access_token, user=UserResponse.model_validate(user))

@router.post("/refresh", response_model=Token)
def refresh(response: Response, refresh_token: str | None = Cookie(None), db: Session = Depends(get_db)):
    if not refresh_token:
        raise APIError(status_code=401, message="Refresh token no proporcionado.")
    
    payload = decode_token(refresh_token)
    user_id = int(payload.get("sub"))
    
    access_token, new_refresh_token = rotate_refresh_token(db, refresh_token, user_id)
    set_refresh_cookie(response, new_refresh_token)
    
    user = db.get(User, user_id)
    return Token(access_token=access_token, user=UserResponse.model_validate(user) if user else None)


@router.post("/logout")
def logout(response: Response, refresh_token: str | None = Cookie(None), db: Session = Depends(get_db)):
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            user_id = int(payload.get("sub"))
            revoke_token(db, refresh_token, user_id)
        except Exception:
            pass # Si el token es inválido, igual borramos la cookie
            
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Sesión cerrada correctamente."}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

