from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database.session import get_db
from app.core.database.models import User, Notification
from app.core.auth_deps import require_authenticated_user
from app.modules.notifications.schemas import NotificationResponse, UnreadCountResponse

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])

def get_user_notification(notification_id: int, current_user: User, db: Session) -> Notification:
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    if notification.recipient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No puedes acceder a notificaciones de otros usuarios")
    return notification

@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    notifications = db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id
    ).order_by(Notification.created_at.desc()).all()
    return notifications

@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    count = db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.read == False
    ).count()
    return UnreadCountResponse(count=count)

@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: int, 
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    notification = get_user_notification(notification_id, current_user, db)
    notification.read = True
    db.commit()
    db.refresh(notification)
    return notification

@router.put("/read-all", status_code=status.HTTP_200_OK)
def mark_all_read(
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"message": "Todas las notificaciones marcadas como leídas"}

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int, 
    current_user: User = Depends(require_authenticated_user), 
    db: Session = Depends(get_db)
):
    notification = get_user_notification(notification_id, current_user, db)
    db.delete(notification)
    db.commit()
    return None
