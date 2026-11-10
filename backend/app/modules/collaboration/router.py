from datetime import UTC
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth_deps import require_authenticated_user
from app.core.database.models import User
from app.core.database.session import get_db
from app.core.dependencies import get_diagram_repo
from app.modules.ai_agent.access import WRITE_ROLES, display_name, require_ai_access
from app.modules.diagram_store import DiagramRepository, user_author

from .service import Coordinator

router = APIRouter(prefix="/api/v1/diagrams/{diagram_id}", tags=["commands"])


class CommandBatch(BaseModel):
    base_revision: int = Field(ge=1)
    batch_id: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9:_-]+$")
    commands: list[dict[str, Any]] = Field(min_length=1, max_length=500)


@router.post("/commands")
async def apply_commands(
    diagram_id: int,
    request: CommandBatch,
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    repo: DiagramRepository = Depends(get_diagram_repo),
) -> dict[str, Any]:
    require_ai_access(db, diagram_id, user, WRITE_ROLES)
    if request.base_revision > repo.current_version(diagram_id):
        from fastapi import HTTPException

        raise HTTPException(409, "La revisión enviada no existe en el servidor.")

    async def authorize() -> None:
        db.expire_all()
        require_ai_access(db, diagram_id, user, WRITE_ROLES)

    result = await Coordinator(repo).apply(
        diagram_id,
        f"user-{user.id}:{request.batch_id}",
        request.commands,
        user_author(user.id, display_name(user)),
        before_commit=authorize,
    )
    if result.get("committed_revision"):
        from datetime import datetime

        from app.core.database.models import Diagram

        diagram = db.get(Diagram, diagram_id)
        diagram.updated_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
    return result


@router.get("/commands/{batch_id}")
def command_receipt(
    diagram_id: int,
    batch_id: str,
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    repo: DiagramRepository = Depends(get_diagram_repo),
) -> dict[str, Any]:
    from fastapi import HTTPException

    require_ai_access(db, diagram_id, user)
    receipt = repo.receipt(diagram_id, f"user-{user.id}:{batch_id}")
    if not receipt:
        raise HTTPException(404, "El lote no está confirmado.")
    return {
        **repo.state(diagram_id),
        "batch_id": batch_id,
        "inverse": receipt.get("inverse", []),
        "committed_revision": receipt["version"],
    }
