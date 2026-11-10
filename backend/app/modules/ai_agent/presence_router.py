"""Activación del agente de IA como participante de la sala colaborativa."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth_deps import require_authenticated_user, require_diagram_access
from app.core.database.models import Diagram, DiagramPermission, User
from app.core.database.session import get_db

router = APIRouter(prefix="/api/v1/diagrams/{diagram_id}/agent", tags=["ai_agent"])


class AgentPresenceUpdate(BaseModel):
    enabled: bool | None = None
    permission: Literal["ask", "safe", "full"] | None = None


class AgentPresenceResponse(BaseModel):
    enabled: bool
    permission: Literal["ask", "safe", "full"] = "ask"


@router.get("", response_model=AgentPresenceResponse)
def get_agent_presence(
    diagram: Diagram = Depends(require_diagram_access),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> AgentPresenceResponse:
    """Cada miembro consulta su preferencia y la presencia común del agente."""
    membership = _membership(db, diagram.id, current_user.id)
    return AgentPresenceResponse(
        enabled=bool(diagram.agent_enabled),
        permission=membership.agent_permission,
    )


@router.put("", response_model=AgentPresenceResponse)
async def set_agent_presence(
    diagram_id: int,
    payload: AgentPresenceUpdate,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    diagram: Diagram = Depends(require_diagram_access),
) -> AgentPresenceResponse:
    """La preferencia es personal; solo OWNER controla la presencia común."""
    membership = _membership(db, diagram_id, current_user.id)
    if payload.enabled is not None:
        if membership.role != "OWNER":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo el propietario puede activar la IA")
        diagram.agent_enabled = payload.enabled
    if payload.permission is not None:
        membership.agent_permission = payload.permission
    if payload.enabled is not None or payload.permission is not None:
        db.commit()
    from app.core.config import settings
    if settings.COLLAB_SERVICE_TOKEN and payload.enabled is not None:
        from contextlib import suppress
        from app.core.dependencies import get_diagram_repo
        from app.modules.collaboration.service import Coordinator
        from .router import get_nosql_repo
        if not payload.enabled:
            await get_nosql_repo().db.agent_runs.update_many(
                {"diagram_id": diagram_id, "status": {"$in": ["queued", "running", "awaiting_approval", "applying"]}},
                {"$set": {"status": "cancelled", "progress": "Agente desactivado por el propietario"}},
            )
        with suppress(HTTPException):
            await Coordinator(get_diagram_repo()).engine("agent_enabled", {"diagram_id": diagram_id, "enabled": payload.enabled})
    return AgentPresenceResponse(
        enabled=bool(diagram.agent_enabled), permission=membership.agent_permission
    )


def _membership(db: Session, diagram_id: int, user_id: int) -> DiagramPermission:
    return db.query(DiagramPermission).filter_by(diagram_id=diagram_id, user_id=user_id).one()
