from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List
import datetime

from app.core.database.session import get_db
from app.core.database.models import (
    User, Diagram, DiagramPermission, DiagramInvitation, Notification,
    DiagramRole, InvitationRole, InvitationStatus
)
from app.core.auth_deps import require_authenticated_user
from app.modules.sharing.schemas import (
    ShareRequest, CreateInvitationRequest, CollaboratorResponse, ChangeRoleRequest, InvitationResponse
)
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
    
    if not permission or permission.role != DiagramRole.OWNER.value:
        raise HTTPException(status_code=403, detail="Solo el propietario del diagrama puede gestionar colaboradores e invitaciones")
    return diagram

@router.post("/invitations", response_model=CollaboratorResponse)
@router.post("/share", response_model=CollaboratorResponse)
def create_invitation(
    diagram_id: int, 
    request: CreateInvitationRequest, 
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    diagram = require_owner(diagram_id, db, current_user)
    
    # Resolver usuario destino por user_id o por username/email
    target_user = None
    if request.user_id:
        target_user = db.query(User).filter(User.id == request.user_id).first()
    elif request.identifier:
        clean_ident = request.identifier.strip()
        target_user = db.query(User).filter(
            or_(User.email == clean_ident, User.username == clean_ident)
        ).first()
        
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en el sistema")
        
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes invitarte a ti mismo al diagrama")

    # Normalizar rol (VIEWER -> READER)
    role_val = request.role
    if role_val == "VIEWER":
        role_val = "READER"

    # 1. Verificar si ya es OWNER o colaborador activo
    existing_permission = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == target_user.id
    ).first()
    
    if existing_permission:
        if existing_permission.role == DiagramRole.OWNER.value:
            raise HTTPException(status_code=400, detail="El usuario ya es el propietario de este diagrama")
        # Si ya es colaborador activo, actualizar rol directamente
        existing_permission.role = role_val
        db.commit()
        return CollaboratorResponse(
            user_id=target_user.id,
            username=target_user.username,
            display_name=target_user.display_name,
            role=existing_permission.role,
            is_pending=False
        )

    # 2. Verificar si ya existe una invitación PENDING (Protección de duplicados / índice único)
    pending_invite = db.query(DiagramInvitation).filter(
        DiagramInvitation.diagram_id == diagram_id,
        DiagramInvitation.invitee_user_id == target_user.id,
        DiagramInvitation.status == InvitationStatus.PENDING.value
    ).first()

    if pending_invite:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una invitación pendiente para este usuario en este diagrama."
        )

    # 3. Transacción atómica: Crear Invitation + Crear Notification
    try:
        invitation = DiagramInvitation(
            diagram_id=diagram_id,
            inviter_user_id=current_user.id,
            invitee_user_id=target_user.id,
            requested_role=role_val,
            status=InvitationStatus.PENDING.value,
            created_at=datetime.datetime.utcnow()
        )
        db.add(invitation)
        db.flush() # Obtener invitation.id

        inviter_name = current_user.display_name or current_user.username
        notification = Notification(
            recipient_user_id=target_user.id,
            type="DIAGRAM_INVITATION",
            title="Invitación a diagrama",
            message=f"{inviter_name} te ha invitado como {role_val} en el diagrama '{diagram.name}'.",
            data={
                "diagram_id": diagram.id,
                "diagram_name": diagram.name,
                "invitation_id": invitation.id,
                "inviter_id": current_user.id,
                "inviter_name": inviter_name,
                "role": role_val
            }
        )
        db.add(notification)
        db.commit()

        return CollaboratorResponse(
            user_id=target_user.id,
            username=target_user.username,
            display_name=target_user.display_name,
            role=role_val,
            is_pending=True,
            invitation_id=invitation.id
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
    
    # 1. Permisos activos
    permissions = db.query(DiagramPermission).filter(DiagramPermission.diagram_id == diagram_id).all()
    collaborators = []
    seen_user_ids = set()

    for p in permissions:
        seen_user_ids.add(p.user_id)
        collaborators.append(CollaboratorResponse(
            user_id=p.user.id,
            username=p.user.username,
            display_name=p.user.display_name,
            role=p.role,
            is_pending=False
        ))

    # 2. Invitaciones pendientes
    pending_invitations = db.query(DiagramInvitation).filter(
        DiagramInvitation.diagram_id == diagram_id,
        DiagramInvitation.status == InvitationStatus.PENDING.value
    ).all()

    for inv in pending_invitations:
        if inv.invitee_user_id not in seen_user_ids:
            collaborators.append(CollaboratorResponse(
                user_id=inv.invitee.id,
                username=inv.invitee.username,
                display_name=inv.invitee.display_name,
                role=inv.requested_role,
                is_pending=True,
                invitation_id=inv.id
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
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="El propietario no puede modificar su propio rol. Debe transferir la propiedad.")

    permission = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == user_id
    ).first()
    
    if not permission:
        raise HTTPException(status_code=404, detail="Colaborador no encontrado en este diagrama")
        
    if permission.role == DiagramRole.OWNER.value:
        raise HTTPException(status_code=400, detail="No puedes cambiar el rol del propietario")
        
    role_val = request.role
    if role_val == "VIEWER":
        role_val = "READER"

    permission.role = role_val
    db.commit()
    
    return CollaboratorResponse(
        user_id=permission.user.id,
        username=permission.user.username,
        display_name=permission.user.display_name,
        role=permission.role,
        is_pending=False
    )

@router.delete("/collaborators/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_access(
    diagram_id: int, 
    user_id: int, 
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    require_owner(diagram_id, db, current_user)
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="El propietario no puede revocarse el acceso a sí mismo.")

    permission = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == diagram_id,
        DiagramPermission.user_id == user_id
    ).first()
    
    # Cancelar cualquier invitación pendiente que tuviera
    pending_invites = db.query(DiagramInvitation).filter(
        DiagramInvitation.diagram_id == diagram_id,
        DiagramInvitation.invitee_user_id == user_id,
        DiagramInvitation.status == InvitationStatus.PENDING.value
    ).all()
    for inv in pending_invites:
        inv.status = InvitationStatus.CANCELLED.value
        inv.responded_at = datetime.datetime.utcnow()

    if permission:
        if permission.role == DiagramRole.OWNER.value:
            raise HTTPException(status_code=400, detail="No puedes revocar al propietario")
        db.delete(permission)
    
    # Notificación de revocación
    notification = Notification(
        recipient_user_id=user_id,
        type="ACCESS_REVOKED",
        title="Acceso revocado",
        message="Se te ha revocado el acceso al diagrama.",
        data={"diagram_id": diagram_id}
    )
    db.add(notification)
    db.commit()
    return None

@router.post("/invitations/{invitation_id}/cancel", status_code=status.HTTP_200_OK)
def cancel_invitation(
    diagram_id: int,
    invitation_id: int,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db)
):
    require_owner(diagram_id, db, current_user)

    invitation = db.query(DiagramInvitation).filter(
        DiagramInvitation.id == invitation_id,
        DiagramInvitation.diagram_id == diagram_id
    ).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")

    if invitation.status != InvitationStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"La invitación ya no está pendiente (estado: {invitation.status})")

    invitation.status = InvitationStatus.CANCELLED.value
    invitation.responded_at = datetime.datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Invitación cancelada correctamente"}
