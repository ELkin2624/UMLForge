import logging
from typing import Dict, Any, List
from .infrastructure.nosql_repository import NoSQLRepository
from .infrastructure.llm_client import LLMClient
from .infrastructure.canvas_patch_builder import CanvasPatchBuilder
from .schemas import CollaborateRequest

logger = logging.getLogger(__name__)


class AIAgentService:
    def __init__(self, repo: NoSQLRepository, llm: LLMClient):
        self.repo = repo
        self.llm = llm

    async def process_private_interaction(self, req: CollaborateRequest) -> Dict[str, Any]:
        """Coordina la consulta privada del usuario manteniendo el cerebro omnisciente compartido."""
        # 1. Obtener contexto privado del usuario + contexto compartido del equipo + bitácora de auditoría
        private_history = await self.repo.get_private_history(req.diagram_id, req.user_id)
        shared_context = await self.repo.get_shared_context(req.diagram_id)
        audit_logs = await self.repo.get_recent_audit_logs(req.diagram_id)

        # 2. Guardar el mensaje del usuario en su historial privado
        await self.repo.append_private_message(
            diagram_id=req.diagram_id,
            user_id=req.user_id,
            role="user",
            content=req.prompt,
            image_base64=req.image_base64,
        )

        # 3. Consultar a Gemini alimentándolo con las dos memorias
        ai_output = await self.llm.invoke_architect_agent(
            user_name=req.user_name,
            user_prompt=req.prompt,
            private_history=private_history,
            shared_decisions=shared_context.get("architectural_decisions", []),
            recent_audit_logs=audit_logs,
            canvas_snapshot=req.current_canvas_snapshot,
            image_base64=req.image_base64,
        )

        # 4. Construir parches canónicos listos para el lienzo y Yjs
        ready_patches = CanvasPatchBuilder.build_yjs_ready_patches(
            ai_output.canvas_patches, author_name=req.user_name
        )

        # 5. Guardar la respuesta del modelo en el historial privado del usuario
        await self.repo.append_private_message(
            diagram_id=req.diagram_id,
            user_id=req.user_id,
            role="model",
            content=ai_output.reply_to_user,
            patches=ready_patches,
        )

        # 6. Si hubo una decisión de diseño relevante para el equipo, registrar en Memoria Compartida y Audit Log
        if ai_output.shared_decision_note:
            await self.repo.append_shared_decision(
                diagram_id=req.diagram_id,
                user_name=req.user_name,
                decision=ai_output.shared_decision_note,
            )
            await self.repo.log_audit_event(
                diagram_id=req.diagram_id,
                actor=f"Gemini IA (vía {req.user_name})",
                action_summary=ai_output.shared_decision_note,
            )

        return {
            "reply": ai_output.reply_to_user,
            "patches": ready_patches,
            "execution_mode": ai_output.execution_mode,
            "shared_decision_note": ai_output.shared_decision_note,
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
