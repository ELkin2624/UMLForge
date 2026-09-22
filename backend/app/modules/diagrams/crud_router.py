from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database.session import get_db
from app.core.database.models import User, Diagram, DiagramPermission
from app.core.auth_deps import require_authenticated_user, require_diagram_role, require_diagram_access
from app.modules.diagrams.crud_schemas import DiagramCreate, DiagramUpdate, DiagramResponse, DiagramDetailResponse

router = APIRouter(prefix="/api/v1/diagrams", tags=["diagrams_crud"])

@router.get("", response_model=List[DiagramResponse])
def list_diagrams(current_user: User = Depends(require_authenticated_user), db: Session = Depends(get_db)):
    # Devuelve los diagramas donde el usuario es owner o tiene permisos
    permissions = db.query(DiagramPermission).filter(DiagramPermission.user_id == current_user.id).all()
    diagram_ids = [p.diagram_id for p in permissions]
    perm_map = {p.diagram_id: p.role for p in permissions}
    diagrams = db.query(Diagram).filter(Diagram.id.in_(diagram_ids)).all()
    
    result = []
    for d in diagrams:
        result.append(DiagramResponse(
            id=d.id,
            name=d.name,
            owner_id=d.owner_id,
            created_at=d.created_at,
            updated_at=d.updated_at,
            my_role=perm_map.get(d.id, "READER")
        ))
    return result

@router.post("", response_model=DiagramDetailResponse)
def create_diagram(diagram_in: DiagramCreate, current_user: User = Depends(require_authenticated_user), db: Session = Depends(get_db)):
    db_diagram = Diagram(
        name=diagram_in.name,
        data=diagram_in.data,
        owner_id=current_user.id
    )
    db.add(db_diagram)
    db.flush()
    
    permission = DiagramPermission(
        diagram_id=db_diagram.id,
        user_id=current_user.id,
        role="OWNER"
    )
    db.add(permission)
    db.commit()
    db.refresh(db_diagram)
    return DiagramDetailResponse(
        id=db_diagram.id,
        name=db_diagram.name,
        owner_id=db_diagram.owner_id,
        created_at=db_diagram.created_at,
        updated_at=db_diagram.updated_at,
        data=db_diagram.data or {},
        my_role="OWNER"
    )

@router.get("/{diagram_id}", response_model=DiagramDetailResponse)
def get_diagram(diagram_id: int, diagram: Diagram = Depends(require_diagram_access), current_user: User = Depends(require_authenticated_user), db: Session = Depends(get_db)):
    perm = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == current_user.id
    ).first()
    return DiagramDetailResponse(
        id=diagram.id,
        name=diagram.name,
        owner_id=diagram.owner_id,
        created_at=diagram.created_at,
        updated_at=diagram.updated_at,
        data=diagram.data or {},
        my_role=perm.role if perm else "READER"
    )

@router.put("/{diagram_id}", response_model=DiagramDetailResponse)
def update_diagram(diagram_id: int, diagram_in: DiagramUpdate, diagram: Diagram = Depends(require_diagram_access), current_user: User = Depends(require_authenticated_user), db: Session = Depends(get_db)):
    # Requerir EDITOR o OWNER
    permission = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == current_user.id
    ).first()
    
    if not permission or permission.role not in ["OWNER", "EDITOR"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para editar este diagrama")
        
    if diagram_in.name is not None:
        diagram.name = diagram_in.name
    if diagram_in.data is not None:
        diagram.data = diagram_in.data
        
    db.commit()
    db.refresh(diagram)
    return diagram

@router.delete("/{diagram_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagram(diagram_id: int, diagram: Diagram = Depends(require_diagram_access), current_user: User = Depends(require_authenticated_user), db: Session = Depends(get_db)):
    # Requiere OWNER
    permission = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == current_user.id
    ).first()
    
    if not permission or permission.role != "OWNER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el propietario puede eliminar el diagrama")
        
    db.delete(diagram)
    db.commit()
    return None
