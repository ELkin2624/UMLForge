import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_deps import require_authenticated_user, require_diagram_access
from app.core.database.models import Diagram, DiagramPermission, User
from app.core.database.session import get_db
from app.core.dependencies import get_diagram_repo
from app.modules.diagram_store import (
    DiagramNotFoundInStore,
    DiagramRepository,
    ai_author,
    user_author,
)
from app.modules.diagrams.crud_schemas import (
    DiagramCreate,
    DiagramDetailResponse,
    DiagramResponse,
    DiagramUpdate,
)

router = APIRouter(prefix="/api/v1/diagrams", tags=["diagrams_crud"])


def display_name(user: User) -> str:
    return user.display_name or user.username


def _role_of(db: Session, diagram_id: int, user_id: int) -> str | None:
    perm = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == user_id,
    ).first()
    return perm.role if perm else None


def _detail(
    diagram: Diagram, data: dict, version: int, role: str | None,
    version_created: bool | None = None,
) -> DiagramDetailResponse:
    return DiagramDetailResponse(
        id=diagram.id,
        name=diagram.name,
        owner_id=diagram.owner_id,
        created_at=diagram.created_at,
        updated_at=diagram.updated_at,
        data=data or {},
        version=version,
        agent_enabled=bool(diagram.agent_enabled),
        my_role=role or "READER",
        version_created=version_created,
    )


@router.get("", response_model=List[DiagramResponse])
def list_diagrams(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    # Devuelve los diagramas donde el usuario es owner o tiene permisos
    permissions = db.query(DiagramPermission).filter(
        DiagramPermission.user_id == current_user.id
    ).all()
    diagram_ids = [p.diagram_id for p in permissions]
    perm_map = {p.diagram_id: p.role for p in permissions}
    diagrams = db.query(Diagram).filter(Diagram.id.in_(diagram_ids)).all()

    return [
        DiagramResponse(
            id=d.id,
            name=d.name,
            owner_id=d.owner_id,
            created_at=d.created_at,
            updated_at=d.updated_at,
            my_role=perm_map.get(d.id, "READER"),
        )
        for d in diagrams
    ]


@router.post("", response_model=DiagramDetailResponse)
def create_diagram(
    diagram_in: DiagramCreate,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    repo: DiagramRepository = Depends(get_diagram_repo),
):
    db_diagram = Diagram(name=diagram_in.name, owner_id=current_user.id)
    db.add(db_diagram)
    db.flush()  # obtiene el id

    db.add(DiagramPermission(
        diagram_id=db_diagram.id, user_id=current_user.id, role="OWNER"
    ))
    # Mongo primero: si falla, el error sube y Postgres no hace commit.
    version = repo.create(
        db_diagram.id, diagram_in.data, user_author(current_user.id, display_name(current_user))
    )
    try:
        db.commit()
    except Exception:
        repo.delete(db_diagram.id)
        raise
    db.refresh(db_diagram)
    return _detail(db_diagram, repo.get_data(db_diagram.id), version, "OWNER")


@router.get("/{diagram_id}", response_model=DiagramDetailResponse)
def get_diagram(
    diagram_id: int,
    diagram: Diagram = Depends(require_diagram_access),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    repo: DiagramRepository = Depends(get_diagram_repo),
):
    try:
        state = repo.state(diagram_id)
    except DiagramNotFoundInStore:
        state = {"data": {}, "layout": {}, "revision": 0}
    result = _detail(
        diagram,
        state["data"],
        state["revision"],
        _role_of(db, diagram_id, current_user.id),
    )
    result.layout = state["layout"]
    return result


@router.put("/{diagram_id}", response_model=DiagramDetailResponse)
async def update_diagram(
    diagram_id: int,
    diagram_in: DiagramUpdate,
    diagram: Diagram = Depends(require_diagram_access),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    repo: DiagramRepository = Depends(get_diagram_repo),
):
    # Requerir EDITOR o OWNER
    role = _role_of(db, diagram_id, current_user.id)
    if role not in ("OWNER", "EDITOR"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para editar este diagrama",
        )

    version_created: bool | None = None
    if diagram_in.data is not None:
        author = (
            ai_author(current_user.id, display_name(current_user))
            if diagram_in.source == "ai"
            else user_author(current_user.id, display_name(current_user))
        )
        from app.modules.diagram_store.repository import RevisionConflict
        import uuid
        if diagram_in.expected_revision is None:
            raise HTTPException(409, "Se requiere expected_revision; recarga el diagrama.")
        try:
            state = repo.state(diagram_id)
            if state["revision"] != diagram_in.expected_revision:
                raise RevisionConflict()
            created = None if state["data"] == diagram_in.data else repo.commit(
                diagram_id, diagram_in.expected_revision, diagram_in.data,
                state["layout"], author, diagram_in.source, f"replace:{uuid.uuid4()}")
            if created:
                from app.modules.collaboration.service import Coordinator
                try:
                    await Coordinator(repo).publish(diagram_id)
                except HTTPException:
                    pass  # El trabajador recupera la publicación pendiente.
        except RevisionConflict:
            raise HTTPException(409, "El diagrama cambió; recarga antes de reemplazarlo.")
        version_created = created is not None

    if diagram_in.name is not None and diagram_in.name != diagram.name:
        diagram.name = diagram_in.name
        db.commit()
    elif version_created:
        diagram.updated_at = datetime.datetime.utcnow()
        db.commit()
    db.refresh(diagram)

    return _detail(
        diagram, repo.get_data(diagram_id), repo.current_version(diagram_id),
        role, version_created,
    )


@router.delete("/{diagram_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagram(
    diagram_id: int,
    diagram: Diagram = Depends(require_diagram_access),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    repo: DiagramRepository = Depends(get_diagram_repo),
):
    # Requiere OWNER
    if _role_of(db, diagram_id, current_user.id) != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el propietario puede eliminar el diagrama",
        )

    db.delete(diagram)
    db.commit()
    repo.delete(diagram_id)
    return None
