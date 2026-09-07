from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Any

class DiagramCreate(BaseModel):
    name: str
    data: dict[str, Any] = {}

class DiagramUpdate(BaseModel):
    name: str | None = None
    data: dict[str, Any] | None = None

class DiagramResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class DiagramDetailResponse(DiagramResponse):
    data: dict[str, Any]
