"""Envío de notificaciones push a través del servicio de Expo.

Los fallos de red o de entrega nunca deben romper la operación que originó la
notificación: se registran y se ignoran.
"""
import logging
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.database.models import DeviceToken
from app.core.database.session import SessionLocal

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_BATCH_SIZE = 100


def tokens_for_user(db: Session, user_id: int) -> list[str]:
    rows = db.query(DeviceToken.token).filter(DeviceToken.user_id == user_id).all()
    return [r[0] for r in rows]


def send_expo_push(
    tokens: list[str], title: str, body: str, data: dict[str, Any] | None = None
) -> None:
    """Envía un push a cada token. Pensado para ejecutarse como tarea en segundo plano."""
    if not tokens:
        return
    messages = [
        {
            "to": t,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
            "channelId": "default",
        }
        for t in tokens
    ]
    dead: list[str] = []
    try:
        with httpx.Client(timeout=10.0) as client:
            for i in range(0, len(messages), EXPO_BATCH_SIZE):
                batch = messages[i : i + EXPO_BATCH_SIZE]
                res = client.post(EXPO_PUSH_URL, json=batch)
                if res.status_code != 200:
                    logger.warning("Expo push devolvió %s: %s", res.status_code, res.text[:200])
                    continue
                # Los tickets llegan en el mismo orden que los mensajes enviados.
                for message, ticket in zip(batch, res.json().get("data", [])):
                    if ticket.get("status") != "error":
                        continue
                    logger.warning("Expo push rechazado: %s", ticket.get("message"))
                    if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                        dead.append(message["to"])
    except Exception:  # noqa: BLE001 - el push es best-effort
        logger.exception("No se pudo enviar la notificación push")
    if dead:
        remove_tokens(dead)


def remove_tokens(tokens: list[str]) -> None:
    """Borra tokens que Expo declaró inválidos. Usa su propia sesión (corre en segundo plano)."""
    try:
        db = SessionLocal()
        try:
            db.query(DeviceToken).filter(DeviceToken.token.in_(tokens)).delete(
                synchronize_session=False
            )
            db.commit()
        finally:
            db.close()
    except Exception:  # noqa: BLE001 - la limpieza también es best-effort
        logger.exception("No se pudieron borrar los tokens push inválidos")
