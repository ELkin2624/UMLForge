"""Consulta el estado vigente de las invitaciones para la bandeja del usuario."""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.database.models import DiagramInvitation, Notification
from app.modules.notifications.schemas import NotificationResponse


def with_invitation_status(
    db: Session, notifications: Sequence[Notification]
) -> list[NotificationResponse]:
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
