"""Orquestación durable: tareas recuperables y propuestas ejecutadas por comandos."""

import asyncio
import json
import logging
import time
import uuid
from contextlib import suppress
from datetime import UTC
from typing import Any

from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.database.models import Diagram, User
from app.core.database.session import SessionLocal
from app.modules.collaboration.service import Coordinator
from app.modules.diagram_store import ai_author

from .access import WRITE_ROLES, require_ai_access
from .context_service import ContextService
from .infrastructure.tool_provider import ToolProvider
from .runs_repository import RunRepository, now
from .tools import TOOLS, definitions

logger = logging.getLogger(__name__)

# Origen de las clases que coloca el agente: a la derecha de la paleta de Apollon
# (unos 170 px a la izquierda del lienzo) para que no queden tapadas.
CANVAS_LEFT = 220
CANVAS_TOP = 60


def check_actor(diagram_id: int, user_id: int) -> None:
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if user is None or not user.is_active:
            raise HTTPException(403, "El solicitante ya no tiene acceso.")
        require_ai_access(db, diagram_id, user, WRITE_ROLES)
        diagram = db.get(Diagram, diagram_id)
        if not diagram or not diagram.agent_enabled:
            raise HTTPException(409, "El agente está desactivado.")


def touch_diagram_index(diagram_id: int) -> None:
    from datetime import datetime

    with SessionLocal() as db:
        diagram = db.get(Diagram, diagram_id)
        if diagram:
            diagram.updated_at = datetime.now(UTC).replace(tzinfo=None)
            db.commit()


class AgentRuntime:
    def __init__(
        self,
        runs: RunRepository,
        diagrams: Any,
        memory: Any,
        provider: Any = None,
        coordinator: Any = None,
        guard: Any = check_actor,
        index_update: Any = touch_diagram_index,
    ):
        self.runs, self.diagrams, self.memory = runs, diagrams, memory
        self.provider = provider or ToolProvider()
        self.coordinator = coordinator or Coordinator(diagrams)
        self.guard = guard
        self.index_update = index_update
        self.owner = uuid.uuid4().hex

    async def allowed(self, run: dict[str, Any]) -> None:
        current = await self.runs.get(run["_id"])
        if (
            not current
            or current["status"] in ("cancelled", "rejected")
            or current.get("worker") not in (None, self.owner)
        ):
            raise asyncio.CancelledError()
        await run_in_threadpool(self.guard, run["diagram_id"], run["user_id"])
        if run.get("approved_by"):
            await run_in_threadpool(self.guard, run["diagram_id"], run["approved_by"])

    async def announce(self, run: dict[str, Any], status: str, **extra: Any) -> None:
        await self.runs.update(
            run["_id"],
            {
                "presence": {
                    "status": status,
                    "run_id": run["_id"],
                    "timestamp": int(time.time() * 1000),
                    **extra,
                }
            },
        )
        await self.coordinator.presence(
            run["diagram_id"],
            status=status,
            run_id=run["_id"],
            timestamp=int(time.time() * 1000),
            **extra,
        )

    async def point(
        self, run: dict[str, Any], name: str, status: str = "pointing"
    ) -> str:
        state = self.diagrams.state(run["diagram_id"])
        cls = next(
            (
                c
                for c in state["data"].get("classes", [])
                if c["id"] == name or c["name"].casefold() == name.casefold()
            ),
            None,
        )
        if cls is None:
            raise ValueError(f"No existe la clase {name}.")
        position = state["layout"].get(cls["id"], {"x": 0, "y": 0})
        await self.announce(
            run,
            status,
            targetId=cls["id"],
            cursor={"x": position["x"] + 40, "y": position["y"] + 12},
        )
        return cls["id"]

    async def tool(
        self,
        run: dict[str, Any],
        name: str,
        arguments: dict[str, Any],
        staged: dict[str, Any],
    ) -> dict[str, Any]:
        await self.allowed(run)
        if name not in TOOLS:
            raise ValueError("Herramienta desconocida.")
        if name == "propose_changes":
            from .tools import Changes

            if "patches" in arguments:
                raw = Changes.model_validate(arguments).model_dump()
                args = {
                    "patches": [
                        TOOLS[name][0].model_validate(patch).model_dump()
                        for patch in raw["patches"]
                    ]
                }
            else:
                if isinstance(arguments.get("payload"), str):
                    arguments["payload"] = json.loads(arguments["payload"])
                patch = TOOLS[name][0].model_validate(arguments).model_dump()
                args = {"patches": [patch]}
        else:
            args = TOOLS[name][0].model_validate(arguments).model_dump()
        state = staged["state"]
        model = state["data"]
        if name == "get_diagram_summary":
            from .context_builder import build_context

            context = build_context(
                model,
                version=state["revision"],
                source="server",
                selection=run.get("selection", []),
            )
            return {
                "summary": context.text,
                "revision": state["revision"],
                "includes_prepared_changes": bool(staged["commands"]),
            }
        if name == "get_class":
            cls = next(
                (
                    c
                    for c in model.get("classes", [])
                    if c["id"] == args["name"]
                    or c["name"].casefold() == args["name"].casefold()
                ),
                None,
            )
            return {"class": cls}
        if name == "list_relationships":
            return {"relationships": model.get("relationships", [])}
        if name == "validate_model":
            from app.core.canonical_model import UMLModel
            from app.core.validators import UMLValidator

            result = UMLValidator().validate(UMLModel.model_validate(model))
            return {"errors": result.errors, "warnings": result.warnings}
        if name == "analyze_normalization":
            from app.modules.data_design.service import analyze

            result = await run_in_threadpool(analyze, model, [])
            return {
                "summary": result.summary.model_dump(),
                "tables": [
                    {"table": item.table, "normal_form": item.normal_form}
                    for item in result.normalization
                ],
            }
        if name == "move_cursor":
            await self.announce(
                run, "pointing", cursor={"x": args["x"], "y": args["y"]}, targetId=None
            )
            return {"cursor": args, "applied": False}
        if name == "point_at":
            return {"target_id": await self.point(run, args["name"])}
        commands = []
        if name == "propose_changes":
            patches = [
                {
                    "patch_id": f"{run['_id']}:{staged['counter']}:{i}",
                    "operation": p["op"],
                    "target": p["target_name"],
                    "data": p["payload"],
                    "reason": p["reason"],
                }
                for i, p in enumerate(args["patches"])
            ]
            result = await self.coordinator.engine(
                "translate",
                {
                    "model": model,
                    "patches": patches,
                    "batch_id": f"{run['_id']}-{staged['counter']}",
                },
            )
            if not result.get("ok"):
                raise ValueError(result.get("message", "Propuesta inválida."))
            commands = result["commands"]
            # Congelar la propuesta como diff del snapshot leído: protege incluso las referencias nuevas.
            commands = await self._freeze(
                model, result["model"], run, staged["counter"]
            )
            for index, cls in enumerate(result["model"].get("classes", [])):
                if not any(old["id"] == cls["id"] for old in model.get("classes", [])):
                    commands.append(
                        {
                            "type": "moveClass",
                            "commandId": f"{run['_id']}:position:{index}",
                            "id": cls["id"],
                            "before": None,
                            "after": {
                                "x": CANVAS_LEFT + (index % 3) * 420,
                                "y": CANVAS_TOP + (index // 3) * 500,
                            },
                        }
                    )
        elif name == "move_class":
            target = next(
                (
                    c
                    for c in model.get("classes", [])
                    if c["name"].casefold() == args["name"].casefold()
                    or c["id"] == args["name"]
                ),
                None,
            )
            if not target:
                raise ValueError("No existe la clase que quieres mover.")
            commands = [
                {
                    "type": "moveClass",
                    "commandId": f"{run['_id']}:{staged['counter']}",
                    "id": target["id"],
                    "before": state["layout"].get(target["id"]),
                    # Conserva el tamaño que el usuario dio a la clase.
                    "after": {
                        **(state["layout"].get(target["id"]) or {}),
                        "x": args["x"],
                        "y": args["y"],
                    },
                }
            ]
            await self.point(run, target["id"])
        elif name == "arrange_classes":
            x, y, row_height = CANVAS_LEFT, CANVAS_TOP, 0
            for i, cls in enumerate(model.get("classes", [])):
                width = max(
                    240,
                    max(
                        (
                            len(a.get("name", "")) + len(a.get("type", ""))
                            for a in cls.get("attributes", [])
                        ),
                        default=0,
                    )
                    * 9
                    + 80,
                )
                height = 110 + 28 * (
                    len(cls.get("attributes", [])) + len(cls.get("operations", []))
                )
                if i and i % 3 == 0:
                    x, y, row_height = CANVAS_LEFT, y + row_height + 100, 0
                commands.append(
                    {
                        "type": "moveClass",
                        "commandId": f"{run['_id']}:{staged['counter']}:{i}",
                        "id": cls["id"],
                        "before": state["layout"].get(cls["id"]),
                        "after": {
                            **(state["layout"].get(cls["id"]) or {}),
                            "x": x,
                            "y": y,
                        },
                    }
                )
                x += width + 100
                row_height = max(row_height, height)
        result = await self.coordinator.engine(
            "execute", {"model": model, "layout": state["layout"], "commands": commands}
        )
        if not result.get("ok"):
            raise ValueError(result.get("message", "No se pudo preparar el cambio."))
        if name == "propose_changes":
            staged["reasons"].extend(p["reason"] for p in args["patches"])
        staged["commands"].extend(commands)
        staged["state"] = {**state, "data": result["model"], "layout": result["layout"]}
        staged["destructive"] |= result.get("destructive", False)
        staged["counter"] += 1
        await self.announce(run, "proposing")
        return {
            "prepared": len(commands),
            "applied": False,
            "requires_approval": run["mode"] == "suggest" or staged["destructive"],
        }

    async def _freeze(
        self,
        before: dict[str, Any],
        after: dict[str, Any],
        run: dict[str, Any],
        index: int,
    ) -> list[dict[str, Any]]:
        # El mismo adaptador que usa Apollon está en el paquete compartido del servidor.
        result = await self.coordinator.engine(
            "diff",
            {"before": before, "after": after, "batch_id": f"{run['_id']}:{index}"},
        )
        return result["commands"]

    async def execute(self, run: dict[str, Any]) -> None:
        receipt = self.diagrams.receipt(run["diagram_id"], f"agent:{run['_id']}")
        if receipt:
            await self.runs.update(
                run["_id"],
                {
                    "inverse": receipt.get("inverse", []),
                    "applied_revision": receipt["version"],
                },
            )
            await self.finish(run)
            return
        await self.allowed(run)
        if run.get("commands"):
            if (
                run["mode"] == "edit"
                and not run.get("destructive")
                or run.get("approved_by")
            ):
                await self.apply(run)
            else:
                await self.runs.update(
                    run["_id"], {"status": "awaiting_approval"}, ["running"]
                )
            return
        state = self.diagrams.state(run["diagram_id"])
        if state["data"].get("components"):
            raise ValueError(
                "Esta versión del agente edita diagramas de clases; componentes aún no están soportados."
            )
        context, _ = await run_in_threadpool(
            ContextService(self.diagrams).build,
            run["diagram_id"],
            run.get("selection", []),
            None,
        )
        history = await self.memory.get_private_history(
            str(run["diagram_id"]), str(run["user_id"])
        )
        decisions = await self.memory.get_shared_context(str(run["diagram_id"]))
        system = (
            "Eres el agente colaborador de UMLForge. Responde en español. Usa herramientas para leer, señalar y preparar TODOS los cambios solicitados. "
            "Nunca afirmes haber aplicado cambios: los ejecuta el servidor después de validar permisos y aprobación. "
            "Cuando TODAS las acciones solicitadas estén preparadas, responde brevemente y termina. Divide varias entidades en varias llamadas a propose_changes; no repitas cambios ya preparados. Una llamada exitosa no completa una petición de varias clases o relaciones. "
            "No cambies el modo elegido por la persona. No elimines y recrees una clase para actualizarla. "
            "Cuando edites algo existente, usa point_at antes de preparar el cambio. "
            "En pedidos concretos respeta los atributos y tipos indicados; no arrastres campos de ejemplos anteriores. Si la solicitud es amplia, explica tus supuestos. "
            "Las razones se comparten con el equipo: explica solo el cambio arquitectónico, no el contenido del chat privado. "
            "Para organizar usa arrange_classes. Para operaciones usa add_operations, update_operations o remove_operations en UPDATE_CLASS. "
            f"Modo: {run['mode']}. Contexto vigente:\n{context.text}\nDecisiones aceptadas:\n{json.dumps(decisions, default=str, ensure_ascii=False)[:12000]}"
        )
        messages = [{"role": "system", "content": system}]
        history_budget = 12000
        selected_history = []
        for item in reversed(history[-8:]):
            if len(item["content"]) > history_budget:
                break
            selected_history.insert(0, item)
            history_budget -= len(item["content"])
        messages += [
            {
                "role": "assistant" if h["role"] == "model" else "user",
                "content": h["content"],
            }
            for h in selected_history
        ]
        info = {
            **context.info(),
            "history_truncated": len(selected_history) < len(history),
        }
        await self.runs.update(run["_id"], {"context": info})
        message: dict[str, Any] = {"role": "user", "content": run["prompt"]}
        if run.get("image_base64"):
            raw = run["image_base64"]
            message["images"] = [raw.split(",", 1)[-1]]
            message["mime_type"] = (
                raw.split(";")[0].replace("data:", "")
                if raw.startswith("data:")
                else "image/png"
            )
        messages.append(message)
        staged = {
            "state": state,
            "commands": [],
            "destructive": False,
            "counter": 0,
            "reasons": [],
        }
        await self.announce(run, "thinking")
        events = []
        for step in range(settings.AGENT_MAX_STEPS):
            await self.allowed(run)
            await self.runs.update(
                run["_id"],
                {
                    "progress": f"Consultando herramientas ({step + 1}/{settings.AGENT_MAX_STEPS})"
                },
                ["running"],
            )
            # Reducir intercambios completos; no dejar respuestas de herramienta sin su llamada.
            while (
                sum(
                    len(str(m.get("content", "")))
                    + len(json.dumps(m.get("tool_calls", []), default=str))
                    for m in messages
                )
                > 40000
            ):
                request_index = next(
                    i for i, item in enumerate(messages) if item is message
                )
                if request_index > 1:
                    messages.pop(1)
                else:
                    rounds = [
                        i
                        for i in range(request_index + 1, len(messages))
                        if messages[i]["role"] == "assistant"
                    ]
                    if len(rounds) < 2:
                        break
                    del messages[rounds[0] : rounds[1]]
                info["messages_truncated"] = True
            await self.runs.update(run["_id"], {"context": info})
            answer = await self.provider.chat(messages, definitions())
            messages.append(answer)
            calls = answer.get("tool_calls", [])
            if len(calls) > 20:
                raise ValueError("El proveedor excedió el límite de herramientas.")
            if not calls:
                reply = str(answer.get("content", "")).strip()
                if not reply:
                    raise ValueError("El proveedor devolvió una respuesta vacía.")
                break
            for call in calls:
                function = call.get("function", {})
                name = function.get("name", "")
                try:
                    arguments = function.get("arguments", {})
                    if isinstance(arguments, str):
                        arguments = json.loads(arguments)
                    result = await self.tool(run, name, arguments, staged)
                except (ValueError, TypeError, KeyError) as exc:
                    from pydantic import ValidationError

                    detail = (
                        [
                            {
                                "field": ".".join(str(k) for k in error["loc"]),
                                "message": error["msg"],
                            }
                            for error in exc.errors()
                        ]
                        if isinstance(exc, ValidationError)
                        else str(exc)[:800]
                    )
                    result = {
                        "error": detail,
                        "expected": "propose_changes({op, target_name, payload:objeto JSON, reason})"
                        if name == "propose_changes"
                        else name,
                        "applied": False,
                    }
                events.append(
                    {
                        "tool": name,
                        "ok": "error" not in result,
                        "error": result.get("error"),
                    }
                )
                await self.runs.update(
                    run["_id"],
                    {"events": events[-100:], "progress": f"Herramienta: {name}"},
                    ["running"],
                )
                encoded = json.dumps(result, default=str, ensure_ascii=False)
                if len(encoded) > 24000:
                    encoded = json.dumps(
                        {"truncated": True, "summary": encoded[:20000]},
                        ensure_ascii=False,
                    )
                messages.append({"role": "tool", "tool_name": name, "content": encoded})
        else:
            raise ValueError(
                "La tarea alcanzó el límite de pasos sin finalizar. No se aplicaron los cambios preparados."
            )
        await self.allowed(run)
        values = {
            "commands": staged["commands"],
            "destructive": staged["destructive"],
            "reasons": staged["reasons"],
            "reply": reply,
            "before": state,
            "preview": staged["state"],
            "progress": "Cambios preparados",
        }
        await self.runs.update(run["_id"], values, ["running"])
        run.update(values)
        if staged["commands"] and (run["mode"] == "suggest" or staged["destructive"]):
            await self.runs.update(
                run["_id"], {"status": "awaiting_approval"}, ["running"]
            )
            await self.announce(run, "proposing")
            await self.save_reply(run, "Propuesta pendiente de aprobación.")
            await self.announce(run, "idle")
        elif staged["commands"]:
            await self.apply(run)
        else:
            await self.finish(run, applied=False)

    async def before_apply(self, run: dict[str, Any]) -> None:
        await self.allowed(run)
        targets = [command["id"] for command in run["commands"] if command.get("id")]
        busy = await self.coordinator.engine(
            "busy", {"diagram_id": run["diagram_id"], "target_ids": targets}
        )
        if busy.get("busy"):
            raise HTTPException(
                409,
                "Una persona está editando estos elementos. Vuelve a proponer el cambio cuando termine.",
            )

    async def apply(self, run: dict[str, Any]) -> None:
        await self.allowed(run)
        for cmd in run["commands"]:
            target = cmd.get("id") or cmd.get("classId")
            if target and any(
                c["id"] == target
                for c in self.diagrams.get_data(run["diagram_id"]).get("classes", [])
            ):
                await self.point(run, target, "applying")
                await asyncio.sleep(0.2)
            elif target:
                position = run.get("preview", {}).get("layout", {}).get(target)
                if position:
                    await self.announce(
                        run,
                        "applying",
                        targetId=target,
                        cursor={"x": position["x"] + 40, "y": position["y"] + 12},
                    )
                    await asyncio.sleep(0.2)
        await self.allowed(run)
        result = await self.coordinator.apply(
            run["diagram_id"],
            f"agent:{run['_id']}",
            run["commands"],
            ai_author(run["user_id"], run["user_name"]),
            "ai",
            before_commit=lambda: self.before_apply(run),
        )
        await self.runs.update(
            run["_id"],
            {
                "inverse": result["inverse"],
                "applied_revision": result.get(
                    "committed_revision", result["revision"]
                ),
            },
        )
        await self.finish(run)

    async def save_reply(self, run: dict[str, Any], suffix: str) -> None:
        # ID estable permite recuperarse tras un reinicio sin duplicar el mensaje.
        await self.memory.db.private_conversations.update_one(
            {"run_id": run["_id"], "role": "model"},
            {
                "$set": {
                    "diagram_id": str(run["diagram_id"]),
                    "user_id": str(run["user_id"]),
                    "content": f"{run.get('reply', '')}\n\n{suffix}",
                    "timestamp": now(),
                }
            },
            upsert=True,
        )

    async def finish(self, run: dict[str, Any], applied: bool = True) -> None:
        if applied:
            try:
                await run_in_threadpool(self.index_update, run["diagram_id"])
            except Exception:
                logger.warning(
                    "Índice SQL pendiente de actualización para %s", run["diagram_id"]
                )
            note = (
                " ".join(dict.fromkeys(run.get("reasons", [])))
                or "Reorganización del lienzo solicitada por el equipo."
            )
            await self.memory.db.shared_ai_memory.update_one(
                {"diagram_id": str(run["diagram_id"])},
                {"$setOnInsert": {"architectural_decisions": []}},
                upsert=True,
            )
            await self.memory.db.shared_ai_memory.update_one(
                {
                    "diagram_id": str(run["diagram_id"]),
                    "architectural_decisions.run_id": {"$ne": run["_id"]},
                },
                {
                    "$push": {
                        "architectural_decisions": {
                            "run_id": run["_id"],
                            "author": run["user_name"],
                            "decision": note,
                            "timestamp": now().isoformat(),
                        }
                    }
                },
            )
            await self.memory.db.design_audit_log.update_one(
                {"run_id": run["_id"]},
                {
                    "$setOnInsert": {
                        "diagram_id": str(run["diagram_id"]),
                        "actor": f"IA (vía {run['user_name']})",
                        "action_summary": note,
                        "timestamp": now(),
                    }
                },
                upsert=True,
            )
        await self.save_reply(
            run, "Cambios aplicados." if applied else "Consulta finalizada."
        )
        await self.runs.update(
            run["_id"],
            {
                "status": "completed",
                "progress": "Aplicado" if applied else "Finalizado",
            },
            None if applied else ["running", "applying"],
        )
        await self.announce(run, "idle")

    async def heartbeat(self, run: dict[str, Any], work: asyncio.Task[Any]) -> None:
        while not work.done():
            await asyncio.sleep(5)
            try:
                await self.allowed(run)
                if not await self.runs.renew(run["diagram_id"], self.owner):
                    work.cancel()
                    return
            except BaseException:
                work.cancel()
                return

    async def tick(self) -> bool:
        run = await self.runs.claim(self.owner)
        if not run:
            return False
        work = asyncio.create_task(self.execute(run))
        heartbeat = asyncio.create_task(self.heartbeat(run, work))
        try:
            started = run.get("execution_started_at", now()).replace(tzinfo=UTC)
            remaining = (
                settings.AGENT_RUN_TIMEOUT_SECONDS
                if run.get("commands")
                else max(
                    0,
                    settings.AGENT_RUN_TIMEOUT_SECONDS
                    - (now() - started).total_seconds(),
                )
            )
            await asyncio.wait_for(work, remaining)
        except asyncio.CancelledError:
            if asyncio.current_task().cancelling():
                work.cancel()
                raise
            # Desactivar o cancelar no revierte un lote ya confirmado.
            if self.diagrams.receipt(run["diagram_id"], f"agent:{run['_id']}"):
                await self.finish(run)
            else:
                await self.runs.update(
                    run["_id"],
                    {"status": "cancelled", "progress": "Cancelado"},
                    ["running"],
                )
        except Exception as exc:
            message = (
                exc.detail
                if isinstance(exc, HTTPException)
                else (
                    "La tarea superó el tiempo máximo; puedes volver a proponerla."
                    if isinstance(exc, TimeoutError)
                    else str(exc)
                )
            )
            logger.warning("Tarea IA %s: %s", run["_id"], message)
            if self.diagrams.receipt(run["diagram_id"], f"agent:{run['_id']}"):
                await self.runs.update(
                    run["_id"],
                    {
                        "status": "running",
                        "progress": "Cambios confirmados; completando el registro",
                    },
                )
                return True
            await self.runs.update(
                run["_id"],
                {
                    "status": "stale"
                    if isinstance(exc, HTTPException) and exc.status_code == 409
                    else "failed",
                    "error": str(message)[:500],
                    "progress": "No se pudo completar",
                },
                ["running", "applying"],
            )
            with suppress(Exception):
                await self.announce(run, "error")
        finally:
            heartbeat.cancel()
            with suppress(asyncio.CancelledError):
                await heartbeat
            await self.runs.release(run["diagram_id"], self.owner)
        return True

    async def loop(self) -> None:
        while True:
            try:
                await self.runs.ensure_indexes()
                await self.tick()
                # Recuperar publicaciones e historial aunque no haya tareas activas.
                for diagram_id in self.diagrams.pending_publications():
                    self.diagrams.project_versions(diagram_id)
                    await self.coordinator.publish(diagram_id)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("El trabajador del agente reintentará la conexión.")
            await asyncio.sleep(1)
