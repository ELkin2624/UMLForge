from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
import datetime

from app.core.database.session import get_db
from app.core.database.models import User, Diagram, DiagramPermission, Notification
from app.core.auth_deps import require_authenticated_user
from app.modules.sharing.schemas import ShareRequest, CollaboratorResponse, ChangeRoleRequest
from app.core.errors import APIError

router = APIRouter(prefix="/api/v1/diagrams/{diagram_id}", tags=["sharing"])

def require_owner(diagram_id: int, db: Session, user: User) -> Diagram:
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagrama no encontrado")
    
    permission = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == user.id
    ).first()
    
    if not permission or permission.role != "OWNER":
        raise HTTPException(status_code=403, detail="Solo el propietario puede realizar esta acción")
    return diagram

@router.post("/share", response_model=CollaboratorResponse)
def share_diagram(
    diagram_id: int, 
    request: ShareRequest, 
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    diagram = require_owner(diagram_id, db, current_user)
    
    target_user = db.query(User).filter(
        or_(User.email == request.identifier, User.username == request.identifier)
    ).first()
    
    if not target_user:
        raise APIError(status_code=404, message="Usuario no encontrado")
        
    if target_user.id == current_user.id:
        raise APIError(status_code=400, message="No puedes compartir el diagrama contigo mismo")
    
    # Transacción
    try:
        permission = db.query(DiagramPermission).filter(
            DiagramPermission.diagram_id == diagram_id,
            DiagramPermission.user_id == target_user.id
        ).first()
        
        if permission:
            if permission.role == "OWNER":
                raise APIError(status_code=400, message="No puedes cambiar el rol del propietario")
            permission.role = request.role
            action = "actualizado el rol a"
        else:
            permission = DiagramPermission(
                diagram_id=diagram_id,
                user_id=target_user.id,
                role=request.role
            )
            db.add(permission)
            action = "agregado como"
            
        notification = Notification(
            recipient_user_id=target_user.id,
            type="DIAGRAM_INVITATION",
            title="Invitación a diagrama",
            message=f"{current_user.username} te ha {action} {request.role} en el diagrama '{diagram.name}'.",
            data={"diagram_id": diagram.id, "sender_id": current_user.id, "role": request.role}
        )
        db.add(notification)
        
        db.commit()
        
        return CollaboratorResponse(
            user_id=target_user.id,
            username=target_user.username,
            display_name=target_user.display_name,
            role=permission.role
        )
    except Exception as e:
        db.rollback()
        raise e

@router.get("/collaborators", response_model=List[CollaboratorResponse])
def get_collaborators(
    diagram_id: int, 
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    require_owner(diagram_id, db, current_user)
    
    permissions = db.query(DiagramPermission).filter(DiagramPermission.diagram_id == diagram_id).all()
    collaborators = []
    for p in permissions:
        collaborators.append(CollaboratorResponse(
            user_id=p.user.id,
            username=p.user.username,
            display_name=p.user.display_name,
            role=p.role
        ))
    return collaborators

@router.put("/collaborators/{user_id}", response_model=CollaboratorResponse)
def change_role(
    diagram_id: int, 
    user_id: int, 
    request: ChangeRoleRequest, 
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    require_owner(diagram_id, db, current_user)
    
    permission = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == user_id
    ).first()
    
    if not permission:
        raise APIError(status_code=404, message="Colaborador no encontrado")
        
    if permission.role == "OWNER":
        raise APIError(status_code=400, message="No puedes cambiar el rol del propietario")
        
    permission.role = request.role
    db.commit()
    
    return CollaboratorResponse(
        user_id=permission.user.id,
        username=permission.user.username,
        display_name=permission.user.display_name,
        role=permission.role
    )

@router.delete("/collaborators/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_access(
    diagram_id: int, 
    user_id: int, 
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    require_owner(diagram_id, db, current_user)
    
    permission = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == user_id
    ).first()
    
    if not permission:
        raise APIError(status_code=404, message="Colaborador no encontrado")
        
    if permission.role == "OWNER":
        raise APIError(status_code=400, message="No puedes revocar al propietario")
        
    db.delete(permission)
    
    # También deberíamos crear una notificación de que fue revocado
    notification = Notification(
        recipient_user_id=user_id,
        type="ACCESS_REVOKED",
        title="Acceso revocado",
        message=f"Se te ha revocado el acceso al diagrama.",
        data={"diagram_id": diagram_id}
    )
    db.add(notification)
    
    db.commit()
    return None
