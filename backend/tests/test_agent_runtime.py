"""Herramientas tipadas y recuperación de tareas sobre MongoDB temporal opcional."""

import asyncio
import os
import uuid
from datetime import timedelta

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.modules.ai_agent.infrastructure.nosql_repository import NoSQLRepository
from app.modules.ai_agent.runs_repository import RunRepository, now
from app.modules.ai_agent.runs_router import public_run
from app.modules.ai_agent.runtime import AgentRuntime
from app.modules.ai_agent.tools import ProposeOperation, definitions
from app.modules.collaboration.service import Coordinator
from app.modules.diagram_store import InMemoryDiagramRepository, user_author
from tests.command_engine import engine


def test_tool_catalog_has_explicit_single_operation_contract():
    tools = {tool["function"]["name"]: tool["function"] for tool in definitions()}
    assert "payload" in tools["propose_changes"]["parameters"]["properties"]
    assert {
        "point_at",
        "arrange_classes",
        "move_class",
        "validate_model",
    } <= tools.keys()
    with pytest.raises(ValueError):
        ProposeOperation.model_validate(
            {"op": "EXECUTE_SQL", "target_name": "x", "reason": "x"}
        )


def test_private_prompts_and_replies_are_not_shared():
    run = {
        "_id": "run",
        "user_id": 1,
        "diagram_id": 5,
        "prompt": "Privado",
        "reply": "Respuesta privada",
        "image_base64": "privada",
        "commands": [],
        "status": "running",
        "mode": "suggest",
        "user_name": "Ana",
    }
    public = public_run(run, 2)
    assert not {"prompt", "reply", "image_base64"} & public.keys()
    assert public_run(run, 1)["reply"] == "Respuesta privada"


class FakeProvider:
    def __init__(self, remove=False):
        self.calls = 0
        self.remove = remove

    async def chat(self, messages, tools):
        self.calls += 1
        if self.calls == 1:
            if self.remove:
                patch = {
                    "op": "UPDATE_CLASS",
                    "target_name": "Cliente",
                    "payload": {"remove_attributes": ["nombre"]},
                    "reason": "Quitar atributo",
                }
            else:
                patch = {
                    "op": "ADD_CLASS",
                    "target_name": "Cliente",
                    "payload": {"attributes": [{"name": "nombre", "type": "String"}]},
                    "reason": "Pedido del usuario",
                }
            return {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {"function": {"name": "propose_changes", "arguments": patch}}
                ],
            }
        return {"role": "assistant", "content": "Preparé los cambios solicitados."}


async def with_runtime(monkeypatch, scenario, remove=False):
    uri = os.getenv("UMLFORGE_TEST_MONGO_URI")
    if not uri:
        pytest.skip("Definir UMLFORGE_TEST_MONGO_URI para probar tareas durables.")
    monkeypatch.setattr(Coordinator, "engine", engine)
    name = "agent_test_" + uuid.uuid4().hex
    client = AsyncIOMotorClient(uri)
    db = client[name]
    runs = RunRepository(db)
    await runs.ensure_indexes()
    repo = InMemoryDiagramRepository()
    initial = {"classes": [], "relationships": []}
    if remove:
        initial["classes"] = [
            {
                "id": "cliente",
                "name": "Cliente",
                "attributes": [{"id": "nombre", "name": "nombre", "type": "String"}],
                "operations": [],
            }
        ]
    repo.create(1, initial, user_author(1, "Ana"))
    memory = NoSQLRepository(uri, name)
    runtime = AgentRuntime(
        runs,
        repo,
        memory,
        provider=FakeProvider(remove),
        guard=lambda diagram, user: None,
        index_update=lambda diagram: None,
    )
    try:
        await scenario(runtime, runs, repo)
    finally:
        await client.drop_database(name)
        client.close()
        memory.client.close()


def test_suggestion_survives_new_worker_and_applies_once(monkeypatch):
    async def scenario(runtime, runs, repo):
        run = await runs.create(
            {
                "diagram_id": 1,
                "user_id": 1,
                "user_name": "Ana",
                "request_id": "request",
                "prompt": "Crea Cliente",
                "mode": "suggest",
            }
        )
        assert await runtime.tick()
        stored = await runs.get(run["_id"])
        assert stored["status"] == "awaiting_approval"
        assert repo.get_data(1)["classes"] == []
        await runs.update(run["_id"], {"status": "applying", "approved_by": 1})
        # La tarea no depende de la instancia ni del navegador que la creó.
        other = AgentRuntime(
            runs,
            repo,
            runtime.memory,
            provider=FakeProvider(),
            guard=lambda diagram, user: None,
            index_update=lambda diagram: None,
        )
        await other.tick()
        assert (await runs.get(run["_id"]))["status"] == "completed"
        assert len(repo.get_data(1)["classes"]) == 1
        revision = repo.current_version(1)
        await runs.update(run["_id"], {"status": "applying"})
        await other.tick()
        assert repo.current_version(1) == revision
        assert len(await runtime.memory.get_shared_context("1")) > 0

    asyncio.run(with_runtime(monkeypatch, scenario))


def test_edit_mode_applies_but_embedded_deletion_requires_approval(monkeypatch):
    async def scenario(runtime, runs, repo):
        run = await runs.create(
            {
                "diagram_id": 1,
                "user_id": 1,
                "user_name": "Ana",
                "request_id": "request",
                "prompt": "Quita nombre",
                "mode": "edit",
            }
        )
        await runtime.tick()
        stored = await runs.get(run["_id"])
        assert stored["status"] == "awaiting_approval" and stored["destructive"]
        assert repo.get_data(1)["classes"][0]["attributes"]

    asyncio.run(with_runtime(monkeypatch, scenario, remove=True))


def test_edit_applies_without_client_and_records_ai_version(monkeypatch):
    async def scenario(runtime, runs, repo):
        run = await runs.create(
            {
                "diagram_id": 1,
                "user_id": 1,
                "user_name": "Ana",
                "request_id": "request",
                "prompt": "Crea Cliente",
                "mode": "edit",
            }
        )
        await runtime.tick()
        assert (await runs.get(run["_id"]))["status"] == "completed"
        assert repo.list_versions(1)[0]["author"]["type"] == "ai"
        assert repo.state(1)["layout"]

    asyncio.run(with_runtime(monkeypatch, scenario))


def test_lease_blocks_second_worker_and_recovers_after_expiration(monkeypatch):
    async def scenario(runtime, runs, repo):
        run = await runs.create(
            {
                "diagram_id": 1,
                "user_id": 1,
                "user_name": "Ana",
                "request_id": "request",
                "prompt": "x",
                "mode": "suggest",
            }
        )
        assert await runs.claim("worker-1")
        assert await runs.claim("worker-2") is None
        await runs.leases.update_one(
            {"_id": 1}, {"$set": {"until": now() - timedelta(seconds=1)}}
        )
        assert (await runs.claim("worker-2"))["_id"] == run["_id"]

    asyncio.run(with_runtime(monkeypatch, scenario))


def test_revoked_permission_prevents_application(monkeypatch):
    async def scenario(runtime, runs, repo):
        run = await runs.create(
            {
                "diagram_id": 1,
                "user_id": 1,
                "user_name": "Ana",
                "request_id": "request",
                "prompt": "x",
                "mode": "edit",
            }
        )

        def deny(diagram, user):
            from fastapi import HTTPException

            raise HTTPException(403, "Permiso revocado")

        runtime.guard = deny
        await runtime.tick()
        assert (await runs.get(run["_id"]))["status"] == "failed"
        assert repo.current_version(1) == 1

    asyncio.run(with_runtime(monkeypatch, scenario))


def test_recovery_after_commit_retries_only_metadata_and_keeps_undo(monkeypatch):
    async def scenario(runtime, runs, repo):
        run = await runs.create(
            {
                "diagram_id": 1,
                "user_id": 1,
                "user_name": "Ana",
                "request_id": "request",
                "prompt": "Crea Cliente",
                "mode": "edit",
            }
        )
        original = runtime.save_reply

        async def fail_reply(*args):
            raise RuntimeError("Historial privado temporalmente caído")

        runtime.save_reply = fail_reply
        await runtime.tick()
        assert repo.current_version(1) == 2
        assert (await runs.get(run["_id"]))["status"] == "running"
        runtime.save_reply = original
        await runtime.tick()
        recovered = await runs.get(run["_id"])
        assert recovered["status"] == "completed" and recovered["inverse"]
        assert repo.current_version(1) == 2
        assert runtime.provider.calls == 2
        memory = await runtime.memory.get_shared_context("1")
        assert len(memory["architectural_decisions"]) == 1

    asyncio.run(with_runtime(monkeypatch, scenario))


def test_cancellation_during_inference_does_not_apply_changes(monkeypatch):
    async def scenario(runtime, runs, repo):
        run = await runs.create(
            {
                "diagram_id": 1,
                "user_id": 1,
                "user_name": "Ana",
                "request_id": "request",
                "prompt": "Crea Cliente",
                "mode": "edit",
            }
        )
        started, release = asyncio.Event(), asyncio.Event()
        provider = runtime.provider

        class SlowProvider:
            async def chat(self, messages, tools):
                started.set()
                await release.wait()
                return await provider.chat(messages, tools)

        runtime.provider = SlowProvider()
        work = asyncio.create_task(runtime.tick())
        await started.wait()
        await runs.update(run["_id"], {"status": "cancelled"})
        release.set()
        await work
        assert repo.current_version(1) == 1
        assert (await runs.get(run["_id"]))["status"] == "cancelled"

    asyncio.run(with_runtime(monkeypatch, scenario))


def test_payloads_reject_unsupported_or_malformed_fields():
    with pytest.raises(ValueError):
        ProposeOperation.model_validate(
            {
                "op": "UPDATE_CLASS",
                "target_name": "Cliente",
                "reason": "x",
                "payload": {"remove_attributes": "nombre"},
            }
        )
    with pytest.raises(ValueError):
        ProposeOperation.model_validate(
            {
                "op": "ADD_CLASS",
                "target_name": "Cliente",
                "reason": "x",
                "payload": {"arbitrary_sql": "DROP TABLE clientes"},
            }
        )


def test_cursor_tools_do_not_mutate_model_and_presence_follows_active_lease(
    monkeypatch,
):
    async def scenario(runtime, runs, repo):
        first = await runs.create(
            {
                "diagram_id": 1,
                "user_id": 1,
                "user_name": "Ana",
                "request_id": "one",
                "prompt": "Señala",
                "mode": "suggest",
            }
        )
        await runs.claim(runtime.owner)
        run = await runs.get(first["_id"])
        staged = {
            "state": repo.state(1),
            "commands": [],
            "reasons": [],
            "destructive": False,
            "counter": 0,
        }
        await runtime.tool(run, "move_cursor", {"x": 100, "y": 200}, staged)
        await runs.create(
            {
                "diagram_id": 1,
                "user_id": 1,
                "user_name": "Ana",
                "request_id": "two",
                "prompt": "En cola",
                "mode": "suggest",
            }
        )
        presence = await runs.room_presence(1)
        assert presence["cursor"] == {"x": 100, "y": 200}
        assert presence["run_id"] == first["_id"]
        assert repo.current_version(1) == 1 and staged["commands"] == []
        with pytest.raises(ValueError):
            await runtime.tool(run, "move_cursor", {"x": float("inf"), "y": 0}, staged)

    asyncio.run(with_runtime(monkeypatch, scenario))
