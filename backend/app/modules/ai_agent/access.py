"""Control de acceso y límites de uso de los endpoints de IA."""

import time
from collections import defaultdict, deque
from collections.abc import Iterable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.database.models import Diagram, DiagramPermission, User

READ_ROLES = ("OWNER", "EDITOR", "READER")
WRITE_ROLES = ("OWNER", "EDITOR")


def require_ai_access(
    db: Session,
    diagram_id: int,
    user: User,
    roles: Iterable[str] = READ_ROLES,
) -> str:
    """Verifica que `user` tenga uno de `roles` sobre el diagrama y devuelve su rol real."""
    if not db.query(Diagram.id).filter(Diagram.id == diagram_id).first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Diagrama no encontrado")
    permission = (
        db.query(DiagramPermission)
        .filter(DiagramPermission.diagram_id == diagram_id, DiagramPermission.user_id == user.id)
        .first()
    )
    if not permission:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a este diagrama")
    if permission.role not in tuple(roles):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Permisos insuficientes")
    return permission.role


def display_name(user: User) -> str:
    return user.display_name or user.username


class RateLimiter:
    """Ventana deslizante en memoria: máximo `limit` llamadas por usuario cada `window` segundos."""

    def __init__(self, limit: int, window: float = 60.0, clock=time.monotonic):
        self.limit = limit
        self.window = window
        self._clock = clock
        self._hits: dict[int, deque[float]] = defaultdict(deque)

    def check(self, user_id: int) -> int | None:
        """Registra una llamada. Devuelve None si está permitida o los segundos de espera."""
        now = self._clock()
        hits = self._hits[user_id]
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return max(1, int(self.window - (now - hits[0])) + 1)
        hits.append(now)
        return None

    def enforce(self, user_id: int) -> None:
        wait = self.check(user_id)
        if wait is not None:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Demasiadas consultas a la IA; espera un momento.",
                headers={"Retry-After": str(wait)},
            )


collaborate_limiter = RateLimiter(limit=20, window=60.0)
