from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth_deps import require_authenticated_user, require_diagram_access
from app.core.database.models import Diagram, DiagramPermission, User
from app.core.database.session import get_db
from app.core.dependencies import get_diagram_repo
from app.modules.diagram_store import (
    DiagramRepository,
    user_author,
)
from app.modules.diagrams.crud_schemas import (
    DiagramDetailResponse,
    VersionDetail,
    VersionSummary,
)

router = APIRouter(prefix="/api/v1/diagrams/{diagram_id}/versions", tags=["versions"])


@router.get("", response_model=list[VersionSummary])
def list_versions(
    diagram_id: int,
    limit: int = Query(50, ge=1, le=200),
    before: int | None = Query(None, ge=1, description="Solo versiones anteriores a esta"),
    _diagram: Diagram = Depends(require_diagram_access),
    repo: DiagramRepository = Depends(get_diagram_repo),
):
    """Historial del diagrama (más nueva primero). Cualquier rol con acceso."""
    return repo.list_versions(diagram_id, limit=limit, before=before)


@router.get("/{version}", response_model=VersionDetail)
def get_version(
    diagram_id: int,
    version: int,
    _diagram: Diagram = Depends(require_diagram_access),
    repo: DiagramRepository = Depends(get_diagram_repo),
):
    """Snapshot completo de una versión (para visualizarla)."""
    found = repo.get_version(diagram_id, version)
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Versión no encontrada")
    return found


@router.post("/{version}/restore", response_model=DiagramDetailResponse)
async def restore_version(
    diagram_id: int,
    version: int,
    payload: dict[str, int] | None = Body(default=None),
    diagram: Diagram = Depends(require_diagram_access),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    repo: DiagramRepository = Depends(get_diagram_repo),
):
    """Restaura una versión como versión nueva. No borra el historial."""
    perm = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == current_user.id,
    ).first()
    if not perm or perm.role not in ("OWNER", "EDITOR"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "No tienes permiso para restaurar versiones"
        )

    import uuid
    from app.modules.collaboration.service import Coordinator
    author = user_author(current_user.id, current_user.display_name or current_user.username)
    state = repo.state(diagram_id)
    if not payload or payload.get("expected_revision") != state["revision"]:
        raise HTTPException(409, "El diagrama cambió; recarga antes de restaurarlo.")
    target = repo.get_version(diagram_id, version)
    if target is None:
        raise HTTPException(404, "Versión no encontrada")
    coordinator = Coordinator(repo)
    batch_id = f"restore:{uuid.uuid4()}"
    diff = await coordinator.engine("diff", {"before": state["data"], "after": target["data"], "batch_id": batch_id})
    commands = diff["commands"]
    for node_id in set(state["layout"]) | set(target.get("layout", {})):
        before, after = state["layout"].get(node_id), target.get("layout", {}).get(node_id)
        if before != after:
            commands.append({"type": "moveClass", "commandId": f"{batch_id}:{node_id}", "id": node_id, "before": before, "after": after})
    created = await coordinator.apply(diagram_id, batch_id, commands, author, "restore", restored_from=version)
    if created is not None:
        import datetime

        diagram.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(diagram)

    return DiagramDetailResponse(
        id=diagram.id,
        name=diagram.name,
        owner_id=diagram.owner_id,
        created_at=diagram.created_at,
        updated_at=diagram.updated_at,
        data=repo.get_data(diagram_id),
        version=repo.current_version(diagram_id),
        my_role=perm.role,
        version_created=created is not None,
        layout=repo.state(diagram_id)["layout"],
    )
