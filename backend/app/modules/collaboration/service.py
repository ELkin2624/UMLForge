import logging
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.modules.diagram_store.repository import DiagramRepository, RevisionConflict

logger = logging.getLogger(__name__)


class Coordinator:
    def __init__(self, repo: DiagramRepository):
        self.repo = repo

    async def engine(self, operation: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not settings.COLLAB_SERVICE_TOKEN:
            raise HTTPException(
                503, "Configura COLLAB_SERVICE_TOKEN en backend y colaboración."
            )
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    f"{settings.COLLAB_INTERNAL_URL}/internal/{operation}",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {settings.COLLAB_SERVICE_TOKEN}"
                    },
                )
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(
                503, "El coordinador de colaboración no está disponible."
            ) from exc

    async def publish(self, diagram_id: int) -> None:
        state = self.repo.state(diagram_id)
        await self.engine("publish", {"diagram_id": diagram_id, **state})
        self.repo.acknowledge_publication(diagram_id, state["revision"])

    async def presence(self, diagram_id: int, **state: Any) -> None:
        await self.engine("presence", {"diagram_id": diagram_id, "state": state})

    async def apply(
        self,
        diagram_id: int,
        batch_id: str,
        commands: list[dict[str, Any]],
        author: dict[str, Any],
        source: str = "user",
        restored_from: int | None = None,
        before_commit: Callable[[], Awaitable[None]] | None = None,
    ) -> dict[str, Any]:
        receipt = self.repo.receipt(diagram_id, batch_id)
        if receipt:
            return {
                **self.repo.state(diagram_id),
                "inverse": receipt.get("inverse", []),
                "batch_id": batch_id,
                "committed_revision": receipt["version"],
            }
        for _ in range(5):
            state = self.repo.state(diagram_id)
            result = await self.engine(
                "execute",
                {
                    "model": state["data"],
                    "layout": state["layout"],
                    "commands": commands,
                },
            )
            if not result.get("ok"):
                raise HTTPException(
                    409 if result.get("code") == "CONFLICT" else 422,
                    result.get("message", "Comandos inválidos."),
                )
            if result["model"] == state["data"] and result["layout"] == state["layout"]:
                return {**state, "inverse": [], "batch_id": batch_id}
            if before_commit:
                await before_commit()
            try:
                committed = self.repo.commit(
                    diagram_id,
                    state["revision"],
                    result["model"],
                    result["layout"],
                    author,
                    source,
                    batch_id,
                    result["inverse"],
                    restored_from=restored_from,
                )
            except RevisionConflict:
                continue
            # La publicación es recuperable: el documento persistente es la autoridad.
            try:
                await self.publish(diagram_id)
            except HTTPException:
                logger.warning("Publicación pendiente de diagrama %s", diagram_id)
            return {
                **self.repo.state(diagram_id),
                "inverse": result["inverse"],
                "batch_id": batch_id,
                "committed_revision": committed["version"],
            }
        raise HTTPException(
            409, "El diagrama cambió varias veces; vuelve a intentarlo."
        )
