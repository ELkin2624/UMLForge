"""Servicio para notificaciones, consulta de estados e integración push."""

from collections.abc import Sequence
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database.models import DiagramInvitation, Notification
from app.modules.notifications.push import send_expo_push, tokens_for_user
from app.modules.notifications.schemas import NotificationResponse


def with_invitation_status(
    db: Session, notifications: Sequence[Notification]
) -> list[NotificationResponse]:
    """Consulta el estado vigente de las invitaciones para la bandeja del usuario."""
    invitation_ids = [
        item.data["invitation_id"]
        for item in notifications
        if item.type == "DIAGRAM_INVITATION"
        and item.data
        and isinstance(item.data.get("invitation_id"), int)
    ]
    statuses: dict[int, str] = {}
    if invitation_ids:
        statuses = {
            invitation.id: invitation.status
            for invitation in db.query(DiagramInvitation)
            .filter(DiagramInvitation.id.in_(invitation_ids))
            .all()
        }

    result = []
    for item in notifications:
        response = NotificationResponse.model_validate(item)
        if item.type == "DIAGRAM_INVITATION" and item.data:
            invitation_id = item.data.get("invitation_id")
            if isinstance(invitation_id, int):
                response.data = {
                    **item.data,
                    "invitation_status": statuses.get(invitation_id, "CANCELLED"),
                }
        result.append(response)
    return result


def add_notification(
    db: Session,
    user_id: int,
    type_: str,
    title: str,
    message: str,
    data: dict[str, Any] | None = None,
) -> Notification:
    """Añade la notificación a la sesión SIN confirmar (para transacciones mayores)."""
    notification = Notification(
        recipient_user_id=user_id,
        type=type_,
        title=title,
        message=message,
        data=data or {},
    )
    db.add(notification)
    return notification


def queue_push(
    db: Session, background_tasks: BackgroundTasks, notification: Notification
) -> None:
    """Encola el push de una notificación ya confirmada."""
    background_tasks.add_task(
        send_expo_push,
        tokens_for_user(db, notification.recipient_user_id),
        notification.title,
        notification.message,
        {"type": notification.type, **(notification.data or {})},
    )


def notify(
    db: Session,
    background_tasks: BackgroundTasks,
    user_id: int,
    type_: str,
    title: str,
    message: str,
    data: dict[str, Any] | None = None,
) -> Notification:
    """Crea la notificación, la confirma y encola su push."""
    notification = add_notification(db, user_id, type_, title, message, data)
    db.commit()
    queue_push(db, background_tasks, notification)
    return notification
