from pydantic import BaseModel, EmailStr, Field

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # El refresh token se enviará en cookie HttpOnly opcionalmente, 
    # pero para simplicidad inicial si no podemos configurar HttpOnly en dev rápido, lo ponemos aquí, 
    # aunque la regla dice preferir HttpOnly. Vamos a dejarlo por ahora y se pondrá en cookie.

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    display_name: str | None = None

class UserLogin(BaseModel):
    identifier: str  # puede ser username o email
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    display_name: str | None
    
    class Config:
        from_attributes = True

class UserSearchResult(BaseModel):
    id: int
    username: str
    display_name: str | None = None
    avatar_url: str | None = None

    class Config:
        from_attributes = True

