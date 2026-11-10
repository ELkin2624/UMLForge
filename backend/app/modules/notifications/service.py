"""Creación de notificaciones y su envío push.

Un solo punto para el patrón «guardar `Notification` + encolar push», de modo que
todo evento que avise a un usuario llegue también a su móvil.
"""
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database.models import Notification
from app.modules.notifications.push import send_expo_push, tokens_for_user


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
