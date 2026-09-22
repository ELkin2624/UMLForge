from pydantic import BaseModel, ConfigDict, EmailStr, Field

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    display_name: str | None = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse | None = None

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    display_name: str | None = None

class UserLogin(BaseModel):
    identifier: str  # puede ser username o email
    password: str

class UserSearchResult(BaseModel):
    id: int
    username: str
    display_name: str | None = None
    avatar_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


