from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import datetime

from app.core.database.session import get_db
from app.core.database.models import (
    User, Diagram, DiagramPermission, DiagramInvitation, Notification,
    InvitationStatus
)
from app.core.auth_deps import require_authenticated_user
from app.modules.sharing.schemas import AcceptInvitationResponse

router = APIRouter(prefix="/api/v1/invitations", tags=["invitations"])

@router.post("/{invitation_id}/accept", response_model=AcceptInvitationResponse)
def accept_invitation(
    invitation_id: int,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db)
):
    invitation = db.query(DiagramInvitation).filter(DiagramInvitation.id == invitation_id).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")

    if invitation.invitee_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes autorización para aceptar esta invitación")

    # 1. Validar estado PENDING (Item 3: 409 Conflict si no es válida o ya fue procesada)
    if invitation.status != InvitationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La invitación no es válida o ya fue procesada (estado actual: {invitation.status})"
        )

    # 2. Validar expiración si corresponde
    if invitation.expires_at and invitation.expires_at < datetime.datetime.utcnow():
        invitation.status = InvitationStatus.EXPIRED.value
        invitation.responded_at = datetime.datetime.utcnow()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La invitación ha expirado"
        )

    diagram = db.query(Diagram).filter(Diagram.id == invitation.diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="El diagrama asociado ya no existe")

    try:
        # 3. Crear o actualizar DiagramPermission (Idempotente / Concurrencia segura)
        permission = db.query(DiagramPermission).filter(
            DiagramPermission.diagram_id == invitation.diagram_id,
            DiagramPermission.user_id == current_user.id
        ).first()

        if permission:
            permission.role = invitation.requested_role
        else:
            permission = DiagramPermission(
                diagram_id=invitation.diagram_id,
                user_id=current_user.id,
                role=invitation.requested_role
            )
            db.add(permission)

        # 4. Actualizar estado de la invitación
        invitation.status = InvitationStatus.ACCEPTED.value
        invitation.responded_at = datetime.datetime.utcnow()

        # 5. Marcar notificación asociada como leída (Item 4)
        notifications = db.query(Notification).filter(
            Notification.recipient_user_id == current_user.id,
            Notification.type == "DIAGRAM_INVITATION"
        ).all()
        for n in notifications:
            if n.data and n.data.get("invitation_id") == invitation_id:
                n.read = True

        db.commit()

        return AcceptInvitationResponse(
            success=True,
            diagram_id=diagram.id,
            diagram_name=diagram.name,
            role=invitation.requested_role
        )
    except Exception as e:
        db.rollback()
        raise e

@router.post("/{invitation_id}/reject", status_code=status.HTTP_200_OK)
def reject_invitation(
    invitation_id: int,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db)
):
    invitation = db.query(DiagramInvitation).filter(DiagramInvitation.id == invitation_id).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")

    if invitation.invitee_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes autorización para rechazar esta invitación")

    if invitation.status != InvitationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La invitación no es válida o ya fue procesada (estado actual: {invitation.status})"
        )

    try:
        # 1. Actualizar estado a REJECTED
        invitation.status = InvitationStatus.REJECTED.value
        invitation.responded_at = datetime.datetime.utcnow()

        # 2. Marcar notificación asociada como leída (Item 4)
        notifications = db.query(Notification).filter(
            Notification.recipient_user_id == current_user.id,
            Notification.type == "DIAGRAM_INVITATION"
        ).all()
        for n in notifications:
            if n.data and n.data.get("invitation_id") == invitation_id:
                n.read = True

        db.commit()

        return {"success": True, "message": "Invitación rechazada exitosamente"}
    except Exception as e:
        db.rollback()
        raise e
