from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Any

class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    read: bool
    data: dict[str, Any] | None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class UnreadCountResponse(BaseModel):
    count: int
