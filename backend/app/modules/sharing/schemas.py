from pydantic import BaseModel, ConfigDict
from typing import Literal

class ShareRequest(BaseModel):
    identifier: str
    role: Literal["EDITOR", "VIEWER"]

class CollaboratorResponse(BaseModel):
    user_id: int
    username: str
    display_name: str | None
    role: str
    
    model_config = ConfigDict(from_attributes=True)

class ChangeRoleRequest(BaseModel):
    role: Literal["EDITOR", "VIEWER"]
