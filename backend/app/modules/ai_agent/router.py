import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from app.core.config import settings
from app.core.security import decode_token
from .schemas import CollaborateRequest, CollaborateResponse, AuditEventCreate
from .infrastructure.nosql_repository import NoSQLRepository
from .infrastructure.llm_client import LLMClient
from .service import AIAgentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai_agent"])

_repo_instance: Optional[NoSQLRepository] = None
_llm_instance: Optional[LLMClient] = None


def get_nosql_repo() -> NoSQLRepository:
    global _repo_instance
    if _repo_instance is None:
        _repo_instance = NoSQLRepository(
            mongo_uri=settings.MONGO_URI,
            db_name=settings.MONGO_DB_NAME,
        )
    return _repo_instance


def get_llm_client() -> LLMClient:
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = LLMClient(api_key=settings.GEMINI_API_KEY)
    return _llm_instance


def get_ai_service(
    repo: NoSQLRepository = Depends(get_nosql_repo),
    llm: LLMClient = Depends(get_llm_client),
) -> AIAgentService:
    return AIAgentService(repo=repo, llm=llm)


def extract_user_id_from_request(request: Request, explicit_user_id: Optional[str] = None) -> str:
    """Extrae el user_id de la query/body o del token Bearer."""
    if explicit_user_id and explicit_user_id.strip():
        return explicit_user_id.strip()

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = decode_token(token)
            sub = payload.get("sub")
            if sub:
                return str(sub)
        except Exception:
            pass

    return "guest_user"


@router.post("/collaborate", response_model=CollaborateResponse)
async def collaborate(
    req: CollaborateRequest,
    service: AIAgentService = Depends(get_ai_service),
) -> CollaborateResponse:
    """Endpoint principal: Procesa la interacción privada de un usuario manteniendo la memoria compartida."""
    try:
        result = await service.process_private_interaction(req)
        return CollaborateResponse(
            reply=result["reply"],
            patches=result["patches"],
            execution_mode=result["execution_mode"],
            shared_decision_note=result.get("shared_decision_note"),
        )
    except Exception as e:
        logger.error(f"Error en endpoint /collaborate: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al procesar consulta con la IA: {str(e)}")


@router.get("/history/{diagram_id}")
async def get_private_history(
    diagram_id: str,
    request: Request,
    user_id: Optional[str] = Query(None, description="ID del usuario cuyo historial privado se solicita"),
    limit: int = Query(30, ge=1, le=100),
    service: AIAgentService = Depends(get_ai_service),
) -> List[Dict[str, Any]]:
    """Carga el historial del chat privado del usuario para este diagrama específico."""
    resolved_user_id = extract_user_id_from_request(request, user_id)
    return await service.get_user_private_history(diagram_id=diagram_id, user_id=resolved_user_id, limit=limit)


@router.delete("/history/{diagram_id}")
async def clear_private_history(
    diagram_id: str,
    request: Request,
    user_id: Optional[str] = Query(None, description="ID del usuario cuyo historial se borrará"),
    service: AIAgentService = Depends(get_ai_service),
) -> Dict[str, Any]:
    """Limpia el historial privado de un usuario para el diagrama."""
    resolved_user_id = extract_user_id_from_request(request, user_id)
    return await service.clear_user_private_history(diagram_id=diagram_id, user_id=resolved_user_id)


@router.get("/shared-memory/{diagram_id}")
async def get_shared_memory(
    diagram_id: str,
    service: AIAgentService = Depends(get_ai_service),
) -> Dict[str, Any]:
    """Devuelve las decisiones arquitectónicas compartidas de todo el equipo en este diagrama."""
    return await service.get_shared_memory(diagram_id=diagram_id)


@router.get("/audit-feed/{diagram_id}")
async def get_audit_feed(
    diagram_id: str,
    limit: int = Query(30, ge=1, le=100),
    service: AIAgentService = Depends(get_ai_service),
) -> List[Dict[str, Any]]:
    """Devuelve el muro cronológico de actividad (audit log) visible por todo el equipo y app móvil."""
    return await service.get_audit_feed(diagram_id=diagram_id, limit=limit)


@router.post("/audit-feed/{diagram_id}")
async def create_audit_log_event(
    diagram_id: str,
    event: AuditEventCreate,
    service: AIAgentService = Depends(get_ai_service),
) -> Dict[str, Any]:
    """Registra un evento manual en la bitácora de auditoría del lienzo."""
    return await service.log_manual_audit_event(
        diagram_id=diagram_id,
        actor=event.actor,
        action_summary=event.action_summary,
    )
