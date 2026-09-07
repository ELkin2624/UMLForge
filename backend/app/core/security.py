import datetime
import jwt
import bcrypt
import hashlib
import hmac
from fastapi import HTTPException, status
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def get_token_hash(token: str) -> str:
    """Hashes a token using SHA-256 (useful for JWTs which exceed bcrypt 72-byte limit)"""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def verify_token_hash(plain_token: str, hashed_token: str) -> bool:
    expected_hash = hashlib.sha256(plain_token.encode('utf-8')).hexdigest()
    return hmac.compare_digest(expected_hash, hashed_token)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.JWT_ACCESS_EXPIRES)
    to_encode.update({"exp": expire, "iat": datetime.datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    import uuid
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.JWT_REFRESH_EXPIRES)
    to_encode.update({"exp": expire, "iat": datetime.datetime.utcnow(), "jti": str(uuid.uuid4())})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
