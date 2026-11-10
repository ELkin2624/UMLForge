import logging
from typing import Dict, Any, List
from starlette.concurrency import run_in_threadpool
from .infrastructure.nosql_repository import NoSQLRepository
from .infrastructure.llm_client import LLMClient
from .infrastructure.canvas_patch_builder import CanvasPatchBuilder
from .context_service import ContextService
from .schemas import CollaborateRequest

logger = logging.getLogger(__name__)


class AIAgentService:
    def __init__(self, repo: NoSQLRepository, llm: LLMClient, contexts: ContextService):
        self.repo = repo
        self.llm = llm
        self.contexts = contexts

    async def process_private_interaction(
        self, req: CollaborateRequest, user_id: str, user_name: str
    ) -> Dict[str, Any]:
        """Coordina la consulta privada del usuario manteniendo el cerebro omnisciente compartido.

        `user_id` y `user_name` vienen del token, nunca del cuerpo de la petición.
        """
        diagram_id = str(req.diagram_id)
        # 1. Obtener contexto privado del usuario + contexto compartido del equipo + bitácora de auditoría
        private_history = await self.repo.get_private_history(diagram_id, user_id)
        shared_context = await self.repo.get_shared_context(diagram_id)
        audit_logs = await self.repo.get_recent_audit_logs(diagram_id)

        # 1b. Contexto del diagrama: sale del almacén (fuente de verdad), no del cliente.
        #     Es código síncrono (pymongo + análisis), así que va a un hilo.
        context, diagram_data = await run_in_threadpool(
            self.contexts.build, req.diagram_id, req.selection, req.current_canvas_snapshot
        )

        # 2. Guardar el mensaje del usuario en su historial privado
        await self.repo.append_private_message(
            diagram_id=diagram_id,
            user_id=user_id,
            role="user",
            content=req.prompt,
            image_base64=req.image_base64,
        )

        # 3. Consultar a Gemini alimentándolo con las dos memorias
        ai_output = await self.llm.invoke_architect_agent(
            user_name=user_name,
            user_prompt=req.prompt,
            private_history=private_history,
            shared_decisions=shared_context.get("architectural_decisions", []),
            recent_audit_logs=audit_logs,
            canvas_snapshot=diagram_data,
            image_base64=req.image_base64,
            diagram_context=context.text,
        )

        simulated = bool(getattr(ai_output, "simulated", False))

        # 4. Construir parches canónicos listos para el lienzo y Yjs
        ready_patches = CanvasPatchBuilder.build_yjs_ready_patches(
            ai_output.canvas_patches, author_name=user_name
        )

        # 5. Guardar la respuesta del modelo en el historial privado del usuario
        await self.repo.append_private_message(
            diagram_id=diagram_id,
            user_id=user_id,
            role="model",
            content=ai_output.reply_to_user,
            patches=ready_patches,
        )

        # Las consultas legacy/móviles solo proponen; las decisiones se registran al aplicar una tarea.
        return {
            "reply": ai_output.reply_to_user,
            "patches": ready_patches,
            "execution_mode": "SUGGESTION",
            "shared_decision_note": ai_output.shared_decision_note,
            "simulated": simulated,
            "context": context.info(),
        }

    async def get_user_private_history(self, diagram_id: str, user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        return await self.repo.get_private_history(diagram_id, user_id, limit=limit)

    async def clear_user_private_history(self, diagram_id: str, user_id: str) -> Dict[str, Any]:
        count = await self.repo.clear_private_history(diagram_id, user_id)
        return {"deleted_count": count}

    async def get_shared_memory(self, diagram_id: str) -> Dict[str, Any]:
        return await self.repo.get_shared_context(diagram_id)

    async def get_audit_feed(self, diagram_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        return await self.repo.get_recent_audit_logs(diagram_id, limit=limit)

    async def log_manual_audit_event(self, diagram_id: str, actor: str, action_summary: str) -> Dict[str, Any]:
        await self.repo.log_audit_event(diagram_id, actor, action_summary)
        return {"status": "recorded"}
