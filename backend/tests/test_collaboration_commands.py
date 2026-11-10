"""Concurrencia, recuperación e idempotencia sin servicios externos."""

import asyncio
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import HTTPException

from app.modules.collaboration.service import Coordinator
from app.modules.diagram_store import InMemoryDiagramRepository, user_author
from app.modules.diagram_store.repository import RevisionConflict
from tests.command_engine import engine


def model(*names):
    return {
        "classes": [
            {"id": name, "name": name, "attributes": [], "operations": []}
            for name in names
        ],
        "relationships": [],
    }


def replace(name, after, before=None):
    return {
        "type": "replaceElement",
        "commandId": "cmd-" + name,
        "id": name,
        "collection": "classes",
        "before": before,
        "after": after,
    }


@pytest.fixture
def room(monkeypatch):
    monkeypatch.setattr(Coordinator, "engine", engine)
    repo = InMemoryDiagramRepository()
    repo.create(1, model(), user_author(1, "Ana"))
    return repo, Coordinator(repo)


def test_cas_only_one_writer_wins(room):
    repo, _ = room

    def write(index):
        try:
            repo.commit(
                1,
                1,
                model(str(index)),
                {},
                user_author(index, "Persona"),
                "user",
                f"batch-{index}",
            )
            return True
        except RevisionConflict:
            return False

    with ThreadPoolExecutor(2) as pool:
        assert sum(pool.map(write, [1, 2])) == 1
    assert repo.current_version(1) == 2


def test_independent_changes_and_duplicate_request(room):
    repo, service = room

    async def scenario():
        commands = [replace("A", model("A")["classes"][0])]
        await service.apply(1, "ana:1", commands, user_author(1, "Ana"))
        await service.apply(
            1, "bob:1", [replace("B", model("B")["classes"][0])], user_author(2, "Bob")
        )
        result = await service.apply(1, "ana:1", commands, user_author(1, "Ana"))
        assert result["revision"] == 3
        assert {c["name"] for c in result["data"]["classes"]} == {"A", "B"}

    asyncio.run(scenario())
    assert len(repo.list_versions(1)) == 3


def test_conflict_does_not_overwrite_and_undo_is_guarded(room):
    repo, service = room

    async def scenario():
        original = model("A")["classes"][0]
        result = await service.apply(
            1, "create", [replace("A", original)], user_author(1, "Ana")
        )
        changed = {**original, "name": "Otro"}
        await service.apply(
            1, "rename", [replace("A", changed, original)], user_author(2, "Bob")
        )
        with pytest.raises(HTTPException) as error:
            await service.apply(1, "undo", result["inverse"], user_author(1, "Ana"))
        assert error.value.status_code == 409
        assert repo.get_data(1)["classes"][0]["name"] == "Otro"

    asyncio.run(scenario())


def test_outbox_recovers_committed_history_after_failure(room, monkeypatch):
    repo, _ = room
    original = repo._insert_version
    monkeypatch.setattr(
        repo,
        "_insert_version",
        lambda event: (_ for _ in ()).throw(RuntimeError("Fallo de escritura")),
    )
    repo.commit(1, 1, model("A"), {}, user_author(1, "Ana"), "user", "persisted")
    assert repo.current_version(1) == 2
    assert repo.receipt(1, "persisted")["version"] == 2
    monkeypatch.setattr(repo, "_insert_version", original)
    repo.project_versions(1)
    repo.project_versions(1)
    assert len(repo.list_versions(1)) == 2
    assert repo.pending_publications() == [1]
    repo.acknowledge_publication(1, 1)
    assert repo.pending_publications() == [1]
    repo.acknowledge_publication(1, 2)
    assert repo.pending_publications() == []


def test_atomic_batch_does_not_partially_apply(room):
    repo, service = room

    async def scenario():
        with pytest.raises(HTTPException):
            await service.apply(
                1,
                "invalid",
                [
                    replace("A", model("A")["classes"][0]),
                    {
                        "type": "renameClass",
                        "id": "missing",
                        "name": "X",
                        "commandId": "bad",
                    },
                ],
                user_author(1, "Ana"),
            )

    asyncio.run(scenario())
    assert repo.current_version(1) == 1


def test_permission_is_rechecked_immediately_before_commit(room):
    repo, service = room

    async def deny():
        raise HTTPException(403, "Permiso revocado")

    async def scenario():
        with pytest.raises(HTTPException) as error:
            await service.apply(
                1,
                "revoked",
                [replace("A", model("A")["classes"][0])],
                user_author(1, "Ana"),
                before_commit=deny,
            )
        assert error.value.status_code == 403

    asyncio.run(scenario())
    assert repo.current_version(1) == 1
