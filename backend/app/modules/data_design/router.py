from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_deps import require_authenticated_user, require_diagram_access
from app.core.database.models import Diagram, DiagramPermission, User
from app.core.database.session import get_db
from app.core.dependencies import get_diagram_repo
from app.modules.diagram_store import DiagramRepository

from .schemas import (
    AnalyzeRequest,
    DataDesignResult,
    DependenciesPayload,
    DependencyDecision,
)
from .service import InvalidModelForDesign, analyze

router = APIRouter(prefix="/api/v1", tags=["data_design"])


@router.post("/data-design/analyze", response_model=DataDesignResult)
def analyze_data_design(
    request: AnalyzeRequest,
    _user: User = Depends(require_authenticated_user),
) -> DataDesignResult:
    """Modelo lógico + normalización (1FN a FNBC) con demostración y descomposición."""
    try:
        return analyze(request.model_data, request.dependencies)
    except InvalidModelForDesign as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.get(
    "/diagrams/{diagram_id}/data-design/dependencies",
    response_model=list[DependencyDecision],
)
def get_dependencies(
    diagram_id: int,
    _diagram: Diagram = Depends(require_diagram_access),
    repo: DiagramRepository = Depends(get_diagram_repo),
):
    """Decisiones guardadas sobre dependencias funcionales (cualquier rol con acceso)."""
    return repo.get_dependencies(diagram_id)


@router.put(
    "/diagrams/{diagram_id}/data-design/dependencies",
    response_model=list[DependencyDecision],
)
def save_dependencies(
    diagram_id: int,
    payload: DependenciesPayload,
    _diagram: Diagram = Depends(require_diagram_access),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    repo: DiagramRepository = Depends(get_diagram_repo),
):
    """Guarda las decisiones (OWNER/EDITOR)."""
    perm = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == current_user.id,
    ).first()
    if not perm or perm.role not in ("OWNER", "EDITOR"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "No tienes permiso para editar este diagrama"
        )
    data = [d.model_dump() for d in payload.dependencies]
    repo.save_dependencies(diagram_id, data)
    return data
