"""Activación del agente de IA como participante de la sala colaborativa."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth_deps import require_authenticated_user
from app.core.database.models import User
from app.core.database.session import get_db
from app.modules.sharing.router import require_owner

router = APIRouter(prefix="/api/v1/diagrams/{diagram_id}/agent", tags=["ai_agent"])


class AgentPresenceUpdate(BaseModel):
    enabled: bool


class AgentPresenceResponse(BaseModel):
    enabled: bool


@router.get("", response_model=AgentPresenceResponse)
def get_agent_presence(
    diagram_id: int,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> AgentPresenceResponse:
    """Estado de la presencia del agente (solo propietario)."""
    diagram = require_owner(diagram_id, db, current_user)
    return AgentPresenceResponse(enabled=bool(diagram.agent_enabled))


@router.put("", response_model=AgentPresenceResponse)
async def set_agent_presence(
    diagram_id: int,
    payload: AgentPresenceUpdate,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> AgentPresenceResponse:
    """Activa o desactiva el agente en el diagrama (solo propietario)."""
    diagram = require_owner(diagram_id, db, current_user)
    diagram.agent_enabled = payload.enabled
    db.commit()
    from app.core.config import settings
    if settings.COLLAB_SERVICE_TOKEN:
        from contextlib import suppress
        from fastapi import HTTPException
        from app.core.dependencies import get_diagram_repo
        from app.modules.collaboration.service import Coordinator
        from .router import get_nosql_repo
        if not payload.enabled:
            await get_nosql_repo().db.agent_runs.update_many(
                {"diagram_id": diagram_id, "status": {"$in": ["queued", "running", "awaiting_approval", "applying"]}},
                {"$set": {"status": "cancelled", "progress": "Agente desactivado por el propietario"}})
        with suppress(HTTPException):
            await Coordinator(get_diagram_repo()).engine("agent_enabled", {"diagram_id": diagram_id, "enabled": payload.enabled})
    return AgentPresenceResponse(enabled=payload.enabled)
