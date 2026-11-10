"""Fixtures globales: los diagramas y el agente de IA viven en MongoDB, que no se usa en tests."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import pytest

from app.core.dependencies import get_diagram_repo
from app.main import app
from app.modules.diagram_store import InMemoryDiagramRepository
from app.modules.ai_agent.router import get_nosql_repo, get_llm_client
from app.modules.ai_agent.infrastructure.llm_client import LLMClient


class InMemoryNoSQLRepository:
    def __init__(self):
        self.private_messages: List[Dict[str, Any]] = []
        self.shared_decisions: Dict[str, List[Dict[str, Any]]] = {}
        self.audit_events: List[Dict[str, Any]] = []

    async def ensure_indexes(self) -> None:
        pass

    async def get_private_history(self, diagram_id: str, user_id: str, limit: int = 25) -> List[Dict[str, Any]]:
        matching = [
            m for m in self.private_messages
            if m["diagram_id"] == str(diagram_id) and m["user_id"] == str(user_id)
        ]
        res = matching[-limit:]
        return [
            {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in msg.items() if k != "_id"}
            for msg in res
        ]

    async def get_team_history(self, diagram_id: str, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        rows = [
            m for m in self.private_messages
            if m["diagram_id"] == str(diagram_id) and m["user_id"] != str(user_id)
        ]
        return [
            {"user_id": m["user_id"], "role": m["role"], "content": m["content"][:500]}
            for m in rows[-limit:]
        ]

    async def append_private_message(
        self,
        diagram_id: str,
        user_id: str,
        role: str,
        content: str,
        patches: Optional[List[Dict[str, Any]]] = None,
        image_base64: Optional[str] = None,
    ) -> None:
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
        self.private_messages.append(doc)

    async def clear_private_history(self, diagram_id: str, user_id: str) -> int:
        before = len(self.private_messages)
        self.private_messages = [
            m for m in self.private_messages
            if not (m["diagram_id"] == str(diagram_id) and m["user_id"] == str(user_id))
        ]
        return before - len(self.private_messages)

    async def get_shared_context(self, diagram_id: str) -> Dict[str, Any]:
        decisions = self.shared_decisions.get(str(diagram_id), [])
        return {"diagram_id": str(diagram_id), "architectural_decisions": decisions}

    async def append_shared_decision(self, diagram_id: str, user_name: str, decision: str) -> None:
        d_id = str(diagram_id)
        if d_id not in self.shared_decisions:
            self.shared_decisions[d_id] = []
        self.shared_decisions[d_id].append({
            "author": user_name,
            "decision": decision,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def get_recent_audit_logs(self, diagram_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        matching = [l for l in self.audit_events if l["diagram_id"] == str(diagram_id)]
        res = matching[-limit:]
        return [
            {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in l.items() if k != "_id"}
            for l in reversed(res)
        ]

    async def log_audit_event(self, diagram_id: str, actor: str, action_summary: str) -> None:
        self.audit_events.append({
            "diagram_id": str(diagram_id),
            "actor": actor,
            "action_summary": action_summary,
            "timestamp": datetime.now(timezone.utc),
        })


@pytest.fixture(autouse=True)
def diagram_repo():
    """Sustituye el almacén Mongo por uno en memoria en todos los tests."""
    repo = InMemoryDiagramRepository()
    app.dependency_overrides[get_diagram_repo] = lambda: repo
    yield repo
    app.dependency_overrides.pop(get_diagram_repo, None)


@pytest.fixture(autouse=True)
def nosql_repo():
    """Sustituye el almacén NoSQL de IA por uno en memoria y fuerza LLM simulado."""
    repo = InMemoryNoSQLRepository()
    llm = LLMClient(api_key="")
    app.dependency_overrides[get_nosql_repo] = lambda: repo
    app.dependency_overrides[get_llm_client] = lambda: llm
    yield repo
    app.dependency_overrides.pop(get_nosql_repo, None)
    app.dependency_overrides.pop(get_llm_client, None)


@pytest.fixture(autouse=True)
def isolated_agent_runtime(monkeypatch):
    """Las pruebas de API no deben arrancar un trabajador contra las bases locales."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "COLLAB_SERVICE_TOKEN", "")
    monkeypatch.setattr(settings, "AGENT_WORKER_ENABLED", False)
