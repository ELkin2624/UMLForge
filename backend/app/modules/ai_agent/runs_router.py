"""API de tareas; las propuestas son compartidas, los prompts y respuestas privados."""

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy.orm import Session

from app.core.auth_deps import require_authenticated_user
from app.core.config import settings
from app.core.database.models import Diagram, User
from app.core.database.session import get_db
from app.core.dependencies import get_diagram_repo
from app.modules.collaboration.service import Coordinator
from app.modules.diagram_store import DiagramRepository

from .access import WRITE_ROLES, collaborate_limiter, display_name, require_ai_access
from .router import get_nosql_repo
from .runs_repository import RunRepository
from .schemas import CollaborateRequest

router = APIRouter(prefix="/api/v1/ai", tags=["agent_runs"])


class StartRun(CollaborateRequest):
    request_id: str = Field(
        default_factory=lambda: uuid.uuid4().hex, min_length=1, max_length=100
    )
    mode: Literal["suggest", "edit"] = "suggest"


def get_run_repo(memory: Any = Depends(get_nosql_repo)) -> RunRepository:
    return RunRepository(memory.db)


def public_run(run: dict[str, Any], user_id: int) -> dict[str, Any]:
    result = {
        key: value
        for key, value in run.items()
        if key
        in {
            "diagram_id",
            "user_id",
            "user_name",
            "mode",
            "status",
            "progress",
            "commands",
            "created_at",
            "updated_at",
            "destructive",
            "reasons",
            "context",
            "error",
            "applied_revision",
            "undone",
        }
    }
    result["id"] = run["_id"]
    if run["user_id"] == user_id:
        result["reply"] = run.get("reply", "")
    return result


def require_enabled(db: Session, diagram_id: int) -> None:
    diagram = db.get(Diagram, diagram_id)
    if not diagram or not diagram.agent_enabled:
        raise HTTPException(
            409, "El propietario debe activar el agente en Colaboración."
        )


@router.get("/room-presence/{diagram_id}")
async def room_presence(
    diagram_id: int,
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    runs: RunRepository = Depends(get_run_repo),
) -> dict[str, Any]:
    require_ai_access(db, diagram_id, user)
    diagram = db.get(Diagram, diagram_id)
    if not diagram.agent_enabled:
        return {"state": {"status": "disabled"}}
    return {"state": await runs.room_presence(diagram_id)}


@router.get("/provider")
async def provider_status(
    _user: User = Depends(require_authenticated_user),
) -> dict[str, Any]:
    import httpx

    if settings.AI_PROVIDER == "ollama":
        try:
            headers = (
                {"Authorization": f"Bearer {settings.OLLAMA_API_TOKEN}"}
                if settings.OLLAMA_API_TOKEN
                else {}
            )
            async with httpx.AsyncClient(timeout=3) as client:
                response = await client.post(
                    f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/show",
                    headers=headers,
                    json={"model": settings.OLLAMA_MODEL},
                )
                response.raise_for_status()
                data = response.json()
            return {
                "provider": "ollama",
                "model": settings.OLLAMA_MODEL,
                "available": "tools" in data.get("capabilities", []),
                "detail": ""
                if "tools" in data.get("capabilities", [])
                else "El modelo no anuncia soporte de herramientas.",
            }
        except (httpx.HTTPError, ValueError):
            return {
                "provider": "ollama",
                "model": settings.OLLAMA_MODEL,
                "available": False,
                "detail": "Ollama o el modelo no están disponibles.",
            }
    return {
        "provider": "gemini",
        "model": "gemini-2.5-flash",
        "available": bool(settings.GEMINI_API_KEY),
        "detail": "Configurado; la disponibilidad se verifica al consultar.",
    }


@router.post("/runs", status_code=202)
async def start_run(
    payload: StartRun,
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    runs: RunRepository = Depends(get_run_repo),
    memory: Any = Depends(get_nosql_repo),
    diagrams: DiagramRepository = Depends(get_diagram_repo),
) -> dict[str, Any]:
    require_ai_access(db, payload.diagram_id, user, WRITE_ROLES)
    require_enabled(db, payload.diagram_id)
    collaborate_limiter.enforce(user.id)
    if not settings.COLLAB_SERVICE_TOKEN or not settings.AGENT_WORKER_ENABLED:
        raise HTTPException(
            503, "El trabajador o el coordinador del agente no están configurados."
        )
    if diagrams.get_data(payload.diagram_id).get("components"):
        raise HTTPException(
            422, "Esta versión del agente solo admite diagramas de clases."
        )
    # Verificar coordinador antes de aceptar una tarea que no podría ejecutarse.
    await Coordinator(diagrams).engine(
        "execute",
        {"model": diagrams.get_data(payload.diagram_id), "layout": {}, "commands": []},
    )
    await runs.ensure_indexes()
    run = await runs.create(
        {
            "diagram_id": payload.diagram_id,
            "user_id": user.id,
            "user_name": display_name(user),
            "request_id": payload.request_id,
            "prompt": payload.prompt,
            "image_base64": payload.image_base64,
            "mode": payload.mode,
            "selection": payload.selection,
        }
    )
    if run["diagram_id"] != payload.diagram_id:
        raise HTTPException(
            409, "El identificador de solicitud ya se usó en otro diagrama."
        )
    await memory.db.private_conversations.update_one(
        {"run_id": run["_id"], "role": "user"},
        {
            "$setOnInsert": {
                "diagram_id": str(payload.diagram_id),
                "user_id": str(user.id),
                "content": payload.prompt,
                "timestamp": run["created_at"],
            }
        },
        upsert=True,
    )
    return public_run(run, user.id)


@router.get("/runs")
async def list_runs(
    diagram_id: int = Query(...),
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    runs: RunRepository = Depends(get_run_repo),
) -> list[dict[str, Any]]:
    require_ai_access(db, diagram_id, user)
    return [public_run(run, user.id) for run in await runs.list(diagram_id)]


async def accessible(
    run_id: str, user: User, db: Session, runs: RunRepository, write: bool = False
) -> dict[str, Any]:
    run = await runs.get(run_id)
    if not run:
        raise HTTPException(404, "Tarea no encontrada.")
    require_ai_access(
        db,
        run["diagram_id"],
        user,
        WRITE_ROLES if write else ("OWNER", "EDITOR", "READER"),
    )
    return run


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    runs: RunRepository = Depends(get_run_repo),
) -> dict[str, Any]:
    return public_run(await accessible(run_id, user, db, runs), user.id)


@router.post("/runs/{run_id}/{action}")
async def act_on_run(
    run_id: str,
    action: Literal["approve", "reject", "cancel", "undo", "retry"],
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    runs: RunRepository = Depends(get_run_repo),
    repo: DiagramRepository = Depends(get_diagram_repo),
) -> dict[str, Any]:
    run = await accessible(run_id, user, db, runs, write=True)
    if action in ("approve", "undo", "retry"):
        require_enabled(db, run["diagram_id"])
    if action == "retry":
        if user.id != run["user_id"]:
            raise HTTPException(
                403, "Solo el solicitante puede volver a enviar su mensaje privado."
            )
        if run["status"] not in ("failed", "stale", "cancelled"):
            raise HTTPException(409, "La tarea aún no necesita reintento.")
        collaborate_limiter.enforce(user.id)
        new_run = await runs.create(
            {
                "diagram_id": run["diagram_id"],
                "user_id": user.id,
                "user_name": display_name(user),
                "request_id": uuid.uuid4().hex,
                "prompt": run["prompt"],
                "mode": run["mode"],
                "selection": run.get("selection", []),
                "image_base64": run.get("image_base64"),
            }
        )
        return public_run(new_run, user.id)
    if action == "approve":
        if run["status"] == "completed":
            return public_run(run, user.id)
        if not await runs.update(
            run_id,
            {
                "status": "applying",
                "approved_by": user.id,
                "progress": "Aprobado; esperando ejecución",
            },
            ["awaiting_approval"],
        ):
            raise HTTPException(409, "La propuesta ya no está pendiente de aprobación.")
    elif action in ("cancel", "reject"):
        if (
            action == "cancel"
            and user.id != run["user_id"]
            and db.get(Diagram, run["diagram_id"]).owner_id != user.id
        ):
            raise HTTPException(
                403, "Solo el solicitante o propietario puede cancelar esta tarea."
            )
        statuses = (
            ["awaiting_approval"]
            if action == "reject"
            else ["queued", "running", "awaiting_approval"]
        )
        if not await runs.update(
            run_id,
            {
                "status": "rejected" if action == "reject" else "cancelled",
                "progress": "Descartado",
            },
            statuses,
        ):
            raise HTTPException(409, "La tarea ya terminó o está aplicando un lote.")
        await Coordinator(repo).presence(run["diagram_id"], status="idle")
    else:
        if user.id != run["user_id"]:
            raise HTTPException(403, "Solo puedes deshacer las tareas que solicitaste.")
        if run["status"] != "completed" or not run.get("inverse"):
            raise HTTPException(409, "Esta tarea no tiene cambios que deshacer.")
        # Los inversos incluyen el estado esperado: nunca revierten cambios posteriores ajenos.
        await Coordinator(repo).apply(
            run["diagram_id"],
            f"undo:{run_id}",
            run["inverse"],
            {"type": "user", "user_id": user.id, "name": display_name(user)},
        )
        await runs.update(run_id, {"undone": True})
    return public_run(await runs.get(run_id), user.id)
