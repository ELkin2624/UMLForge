"""Tareas durables y exclusión por diagrama; no guarda tokens de usuario."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


def now() -> datetime:
    return datetime.now(UTC)


class RunRepository:
    def __init__(self, db: Any):
        self.runs = db.agent_runs
        self.leases = db.agent_leases

    async def ensure_indexes(self) -> None:
        await self.runs.create_index([("diagram_id", 1), ("created_at", -1)])
        await self.runs.create_index([("user_id", 1), ("request_id", 1)], unique=True)

    async def create(self, data: dict[str, Any]) -> dict[str, Any]:
        document = {
            **data,
            "_id": uuid.uuid4().hex,
            "created_at": now(),
            "updated_at": now(),
            "status": "queued",
            "commands": [],
            "progress": "En cola",
            "reply": "",
        }
        try:
            await self.runs.insert_one(document)
        except DuplicateKeyError:
            return await self.runs.find_one(
                {"user_id": data["user_id"], "request_id": data["request_id"]}
            )
        return document

    async def get(self, run_id: str) -> dict[str, Any] | None:
        return await self.runs.find_one({"_id": run_id})

    async def update(
        self, run_id: str, values: dict[str, Any], statuses: list[str] | None = None
    ) -> bool:
        query: dict[str, Any] = {"_id": run_id}
        if statuses is not None:
            query["status"] = {"$in": statuses}
        result = await self.runs.update_one(
            query, {"$set": {**values, "updated_at": now()}}
        )
        return bool(result.matched_count)

    async def list(self, diagram_id: int) -> list[dict[str, Any]]:
        return (
            await self.runs.find({"diagram_id": diagram_id})
            .sort("created_at", -1)
            .limit(30)
            .to_list(30)
        )

    async def claim(self, owner: str) -> dict[str, Any] | None:
        # Una tarea cuyo trabajador perdió el lease debe poder recuperarse.
        candidates = (
            await self.runs.find({"status": {"$in": ["queued", "running", "applying"]}})
            .sort("created_at", 1)
            .limit(30)
            .to_list(30)
        )
        for run in candidates:
            try:
                lease = await self.leases.find_one_and_update(
                    {
                        "_id": run["diagram_id"],
                        "$or": [{"until": {"$lt": now()}}, {"owner": owner}],
                    },
                    {
                        "$set": {
                            "owner": owner,
                            "run_id": run["_id"],
                            "until": now() + timedelta(seconds=30),
                        }
                    },
                    upsert=True,
                    return_document=ReturnDocument.AFTER,
                )
            except DuplicateKeyError:
                continue
            if lease:
                if await self.update(
                    run["_id"],
                    {
                        "status": "running",
                        "worker": owner,
                        "execution_started_at": run.get("execution_started_at", now()),
                    },
                    ["queued", "running", "applying"],
                ):
                    return await self.get(run["_id"])
                await self.release(run["diagram_id"], owner)
        return None

    async def renew(self, diagram_id: int, owner: str) -> bool:
        result = await self.leases.update_one(
            {"_id": diagram_id, "owner": owner},
            {"$set": {"until": now() + timedelta(seconds=30)}},
        )
        return bool(result.matched_count)

    async def release(self, diagram_id: int, owner: str) -> None:
        await self.leases.delete_one({"_id": diagram_id, "owner": owner})

    async def room_presence(self, diagram_id: int) -> dict[str, Any]:
        lease = await self.leases.find_one(
            {"_id": diagram_id, "until": {"$gte": now()}}
        )
        query = (
            {"_id": lease["run_id"]}
            if lease and lease.get("run_id")
            else {"diagram_id": diagram_id}
        )
        run = await self.runs.find_one(
            query, {"presence": 1, "status": 1}, sort=[("updated_at", -1)]
        )
        if run:
            if run["status"] in ("cancelled", "rejected"):
                return {"status": "idle"}
            return run.get("presence") or {
                "status": "thinking"
                if run["status"] in ("running", "applying")
                else "idle",
                "run_id": run["_id"],
            }
        return {"status": "idle"}
