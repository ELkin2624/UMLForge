import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal, Optional
from app.core.database.models import DiagramRole, InvitationRole, InvitationStatus

class ShareRequest(BaseModel):
    user_id: Optional[int] = None
    identifier: Optional[str] = None
    role: Literal["EDITOR", "READER", "VIEWER"] = "EDITOR"

class CreateInvitationRequest(BaseModel):
    user_id: Optional[int] = None
    identifier: Optional[str] = None # username o email fallback
    role: Literal["EDITOR", "READER", "VIEWER"] = "EDITOR"

class ChangeRoleRequest(BaseModel):
    role: Literal["EDITOR", "READER", "VIEWER"]

class CollaboratorResponse(BaseModel):
    user_id: int
    username: str
    display_name: Optional[str] = None
    role: str
    is_pending: bool = False
    invitation_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

class InvitationResponse(BaseModel):
    id: int
    diagram_id: int
    diagram_name: Optional[str] = None
    inviter_user_id: int
    inviter_name: Optional[str] = None
    invitee_user_id: int
    invitee_username: Optional[str] = None
    requested_role: str
    status: str
    created_at: datetime.datetime
    responded_at: Optional[datetime.datetime] = None
    expires_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AcceptInvitationResponse(BaseModel):
    success: bool = True
    diagram_id: int
    diagram_name: str
    role: str
