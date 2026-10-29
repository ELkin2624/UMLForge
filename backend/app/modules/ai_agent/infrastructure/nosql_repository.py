import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)


class NoSQLRepository:
    def __init__(self, mongo_uri: str, db_name: str = "umlforge_ai"):
        self.mongo_uri = mongo_uri
        self.db_name = db_name
        self._client: Optional[AsyncIOMotorClient] = None
        self._indexes_created = False

    @property
    def client(self) -> AsyncIOMotorClient:
        """Obtiene o recrea el cliente asegurando que esté atado al event loop activo."""
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        active_loop = getattr(self, "_active_loop", None)
        if self._client is None or (current_loop is not None and active_loop != current_loop):
            self._client = AsyncIOMotorClient(self.mongo_uri)
            self._active_loop = current_loop
        return self._client

    @property
    def db(self):
        return self.client[self.db_name]

    @property
    def private_chats(self):
        return self.db["private_conversations"]

    @property
    def shared_memory(self):
        return self.db["shared_ai_memory"]

    @property
    def audit_logs(self):
        return self.db["design_audit_log"]

    async def ensure_indexes(self) -> None:
        if not self._indexes_created:
            try:
                await self.private_chats.create_index([("diagram_id", 1), ("user_id", 1), ("timestamp", -1)])
                await self.shared_memory.create_index([("diagram_id", 1)], unique=True)
                await self.audit_logs.create_index([("diagram_id", 1), ("timestamp", -1)])
                self._indexes_created = True
            except Exception as e:
                logger.warning(f"Error asegurando índices MongoDB: {e}")

    async def get_private_history(self, diagram_id: str, user_id: str, limit: int = 25) -> List[Dict[str, Any]]:
        await self.ensure_indexes()
        cursor = (
            self.private_chats.find(
                {"diagram_id": str(diagram_id), "user_id": str(user_id)},
                {"_id": 0},
            )
            .sort("timestamp", -1)
            .limit(limit)
        )
        messages = await cursor.to_list(length=limit)
        for msg in messages:
            if isinstance(msg.get("timestamp"), datetime):
                msg["timestamp"] = msg["timestamp"].isoformat()
        return list(reversed(messages))

    async def append_private_message(
        self,
        diagram_id: str,
        user_id: str,
        role: str,
        content: str,
        patches: Optional[List[Dict[str, Any]]] = None,
        image_base64: Optional[str] = None,
    ) -> None:
        await self.ensure_indexes()
        doc: Dict[str, Any] = {
            "diagram_id": str(diagram_id),
            "user_id": str(user_id),
            "role": role,
            "content": content,
            "patches": patches or [],
            "timestamp": datetime.now(timezone.utc),
        }
        if image_base64:
            doc["image_base64"] = image_base64
        await self.private_chats.insert_one(doc)

    async def clear_private_history(self, diagram_id: str, user_id: str) -> int:
        await self.ensure_indexes()
        result = await self.private_chats.delete_many({
            "diagram_id": str(diagram_id),
            "user_id": str(user_id),
        })
        return result.deleted_count

    async def get_shared_context(self, diagram_id: str) -> Dict[str, Any]:
        await self.ensure_indexes()
        doc = await self.shared_memory.find_one({"diagram_id": str(diagram_id)}, {"_id": 0})
        return doc or {"diagram_id": str(diagram_id), "architectural_decisions": []}

    async def append_shared_decision(self, diagram_id: str, user_name: str, decision: str) -> None:
        await self.ensure_indexes()
        await self.shared_memory.update_one(
            {"diagram_id": str(diagram_id)},
            {
                "$push": {
                    "architectural_decisions": {
                        "author": user_name,
                        "decision": decision,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                }
            },
            upsert=True,
        )

    async def get_recent_audit_logs(self, diagram_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        await self.ensure_indexes()
        cursor = (
            self.audit_logs.find({"diagram_id": str(diagram_id)}, {"_id": 0})
            .sort("timestamp", -1)
            .limit(limit)
        )
        logs = await cursor.to_list(length=limit)
        for log in logs:
            if isinstance(log.get("timestamp"), datetime):
                log["timestamp"] = log["timestamp"].isoformat()
        return logs

    async def log_audit_event(self, diagram_id: str, actor: str, action_summary: str) -> None:
        await self.ensure_indexes()
        await self.audit_logs.insert_one({
            "diagram_id": str(diagram_id),
            "actor": actor,
            "action_summary": action_summary,
            "timestamp": datetime.now(timezone.utc),
        })
