"""Autorización y privacidad del nuevo contrato de tareas."""

import copy
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.config import settings
from app.core.database.models import Diagram
from app.main import app
from app.modules.ai_agent.router import get_nosql_repo
from app.modules.ai_agent.runs_router import get_run_repo
from tests.api import test_diagrams_versions as fixtures

client = fixtures.client
db_session = fixtures.db_session
world = fixtures.world
coordinator_engine = fixtures.coordinator_engine


class Runs:
    def __init__(self):
        self.documents = {}

    async def ensure_indexes(self):
        pass

    async def create(self, data):
        for run in self.documents.values():
            if (
                run["request_id"] == data["request_id"]
                and run["user_id"] == data["user_id"]
            ):
                return copy.deepcopy(run)
        run = {
            **data,
            "_id": uuid.uuid4().hex,
            "status": "queued",
            "commands": [],
            "progress": "En cola",
            "created_at": datetime.now(UTC),
        }
        self.documents[run["_id"]] = run
        return copy.deepcopy(run)

    async def get(self, key):
        return copy.deepcopy(self.documents.get(key))

    async def list(self, diagram):
        return [
            copy.deepcopy(run)
            for run in self.documents.values()
            if run["diagram_id"] == diagram
        ]

    async def update(self, key, values, statuses=None):
        run = self.documents.get(key)
        if not run or statuses and run["status"] not in statuses:
            return False
        run.update(values)
        return True


@pytest.fixture
def tasks(monkeypatch, world, db_session):
    monkeypatch.setattr(settings, "COLLAB_SERVICE_TOKEN", "test-token")
    monkeypatch.setattr(settings, "AGENT_WORKER_ENABLED", True)
    diagram = db_session.get(Diagram, world["id"])
    diagram.agent_enabled = True
    db_session.commit()
    runs = Runs()
    app.dependency_overrides[get_run_repo] = lambda: runs
    memory = SimpleNamespace(
        db=SimpleNamespace(
            private_conversations=SimpleNamespace(update_one=AsyncMock())
        )
    )
    app.dependency_overrides[get_nosql_repo] = lambda: memory
    yield runs
    app.dependency_overrides.pop(get_run_repo, None)
    app.dependency_overrides.pop(get_nosql_repo, None)


def start(client, world, who="owner", **extra):
    return client.post(
        "/api/v1/ai/runs",
        json={
            "diagram_id": world["id"],
            "prompt": "Mensaje privado",
            "request_id": uuid.uuid4().hex,
            **extra,
        },
        headers=world[who],
    )


def test_mode_is_explicit_and_duplicate_requests_are_idempotent(client, world, tasks):
    one = start(client, world, request_id="stable", mode="suggest")
    two = start(client, world, request_id="stable", mode="suggest")
    assert one.status_code == two.status_code == 202
    assert one.json()["id"] == two.json()["id"]
    assert one.json()["mode"] == "suggest"
    assert start(client, world, mode="automatic").status_code == 422


def test_reader_cannot_create_or_approve_tasks(client, world, tasks):
    assert start(client, world, "reader").status_code == 403
    run = start(client, world).json()
    tasks.documents[run["id"]]["status"] = "awaiting_approval"
    assert (
        client.post(
            f"/api/v1/ai/runs/{run['id']}/approve", headers=world["reader"]
        ).status_code
        == 403
    )


def test_shared_proposals_do_not_reveal_chat_or_private_reply(client, world, tasks):
    run = start(client, world, "editor").json()
    tasks.documents[run["id"]].update(
        reply="Respuesta privada",
        status="awaiting_approval",
        commands=[{"type": "moveClass", "id": "x"}],
    )
    owner = client.get(
        "/api/v1/ai/runs", params={"diagram_id": world["id"]}, headers=world["owner"]
    ).json()[0]
    assert not {"prompt", "image_base64", "reply"} & owner.keys()
    assert owner["commands"]
    mine = client.get(
        "/api/v1/ai/runs", params={"diagram_id": world["id"]}, headers=world["editor"]
    ).json()[0]
    assert mine["reply"] == "Respuesta privada"


def test_approval_is_claimed_once_and_waits_for_worker(client, world, tasks):
    run = start(client, world).json()
    tasks.documents[run["id"]].update(
        status="awaiting_approval",
        commands=[{"type": "deleteClass", "id": "c"}],
        destructive=True,
    )
    response = client.post(
        f"/api/v1/ai/runs/{run['id']}/approve", headers=world["editor"]
    )
    assert response.status_code == 200 and response.json()["status"] == "applying"
    assert (
        client.post(
            f"/api/v1/ai/runs/{run['id']}/approve", headers=world["editor"]
        ).status_code
        == 409
    )


def test_only_requester_or_owner_can_cancel(client, world, tasks):
    run = start(client, world).json()
    assert (
        client.post(
            f"/api/v1/ai/runs/{run['id']}/cancel", headers=world["editor"]
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/ai/runs/{run['id']}/cancel", headers=world["owner"]
        ).json()["status"]
        == "cancelled"
    )


def test_disabled_agent_rejects_new_work(client, world, tasks, db_session):
    diagram = db_session.get(Diagram, world["id"])
    diagram.agent_enabled = False
    db_session.commit()
    assert start(client, world).status_code == 409


def test_replacement_without_revision_is_rejected(client, world, tasks):
    assert (
        client.put(
            f"/api/v1/diagrams/{world['id']}", json={"data": {}}, headers=world["owner"]
        ).status_code
        == 409
    )


def test_commands_enforce_roles_and_allow_disjoint_stale_base(client, world, tasks):
    def send(name, role="owner", revision=1):
        return client.post(
            f"/api/v1/diagrams/{world['id']}/commands",
            headers=world[role],
            json={
                "batch_id": name,
                "base_revision": revision,
                "commands": [
                    {
                        "type": "replaceElement",
                        "commandId": name,
                        "collection": "classes",
                        "id": name,
                        "before": None,
                        "after": {
                            "id": name,
                            "name": name,
                            "attributes": [],
                            "operations": [],
                        },
                    }
                ],
            },
        )

    assert send("A").status_code == 200
    assert send("B", "editor").status_code == 200
    assert send("C", "reader").status_code == 403
    assert send("D", "editor", 999).status_code == 409
    state = client.get(f"/api/v1/diagrams/{world['id']}", headers=world["owner"]).json()
    assert {cls["name"] for cls in state["data"]["classes"]} == {"A", "B"}


def test_command_receipt_recovers_lost_response_without_repeating_mutation(
    client, world, tasks
):
    body = {
        "batch_id": "lost-response",
        "base_revision": 1,
        "commands": [
            {
                "type": "replaceElement",
                "commandId": "one",
                "collection": "classes",
                "id": "c",
                "before": None,
                "after": {
                    "id": "c",
                    "name": "Cliente",
                    "attributes": [],
                    "operations": [],
                },
            }
        ],
    }
    url = f"/api/v1/diagrams/{world['id']}/commands"
    first = client.post(url, json=body, headers=world["owner"])
    assert first.status_code == 200
    receipt = client.get(url + "/lost-response", headers=world["owner"])
    assert receipt.status_code == 200 and receipt.json()["committed_revision"] == 2
    assert client.post(url, json=body, headers=world["owner"]).json()["revision"] == 2
    assert (
        client.get(url + "/lost-response", headers=world["reader"]).status_code == 404
    )
