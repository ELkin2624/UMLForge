import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth_deps import require_authenticated_user
from app.core.config import settings
from app.core.database.models import DiagramPermission, User
from app.core.database.session import get_db
from app.core.dependencies import get_diagram_repo
from app.modules.diagram_store import DiagramRepository

from .access import (
    READ_ROLES,
    WRITE_ROLES,
    collaborate_limiter,
    display_name,
    require_ai_access,
)
from .context_service import ContextService
from .infrastructure.llm_client import LLMClient
from .infrastructure.nosql_repository import NoSQLRepository
from .schemas import AuditEventCreate, CollaborateRequest, CollaborateResponse
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
        _llm_instance = LLMClient(
            api_key=settings.GEMINI_API_KEY,
            provider=settings.AI_PROVIDER,
            ollama_base_url=settings.OLLAMA_BASE_URL,
            ollama_model=settings.OLLAMA_MODEL,
            ollama_timeout_seconds=settings.OLLAMA_TIMEOUT_SECONDS,
            ollama_api_token=settings.OLLAMA_API_TOKEN,
        )
    return _llm_instance


def get_ai_service(
    repo: NoSQLRepository = Depends(get_nosql_repo),
    llm: LLMClient = Depends(get_llm_client),
    diagrams: DiagramRepository = Depends(get_diagram_repo),
) -> AIAgentService:
    return AIAgentService(repo=repo, llm=llm, contexts=ContextService(diagrams))


@router.post("/collaborate", response_model=CollaborateResponse)
async def collaborate(
    req: CollaborateRequest,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    service: AIAgentService = Depends(get_ai_service),
) -> CollaborateResponse:
    """Chat privado para cualquier miembro; un lector no puede aplicar parches."""
    role = require_ai_access(db, req.diagram_id, current_user, READ_ROLES)
    collaborate_limiter.enforce(current_user.id)
    membership = db.query(DiagramPermission).filter_by(
        diagram_id=req.diagram_id, user_id=current_user.id
    ).one()
    try:
        result = await service.process_private_interaction(
            req,
            user_id=str(current_user.id),
            user_name=display_name(current_user),
            permission=membership.agent_permission if role in WRITE_ROLES else "ask",
        )
        return CollaborateResponse(
            reply=result["reply"],
            patches=result["patches"],
            execution_mode=result["execution_mode"],
            shared_decision_note=result.get("shared_decision_note"),
            simulated=result.get("simulated", False),
            context=result.get("context", {}),
            permission=result.get("permission", "ask"),
            allow_delete=result.get("allow_delete", False),
        )
    except Exception as e:
        # El detalle técnico va al log, no al cliente.
        logger.error("Error en endpoint /collaborate: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="El proveedor de IA no está disponible")


@router.get("/history/{diagram_id}")
async def get_private_history(
    diagram_id: int,
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    service: AIAgentService = Depends(get_ai_service),
) -> List[Dict[str, Any]]:
    """Historial del chat privado del usuario autenticado (nunca el de otro usuario)."""
    require_ai_access(db, diagram_id, current_user, READ_ROLES)
    return await service.get_user_private_history(
        diagram_id=str(diagram_id), user_id=str(current_user.id), limit=limit
    )


@router.delete("/history/{diagram_id}")
async def clear_private_history(
    diagram_id: int,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    service: AIAgentService = Depends(get_ai_service),
) -> Dict[str, Any]:
    """Borra el historial privado del usuario autenticado en este diagrama."""
    require_ai_access(db, diagram_id, current_user, READ_ROLES)
    return await service.clear_user_private_history(
        diagram_id=str(diagram_id), user_id=str(current_user.id)
    )


@router.get("/shared-memory/{diagram_id}")
async def get_shared_memory(
    diagram_id: int,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    service: AIAgentService = Depends(get_ai_service),
) -> Dict[str, Any]:
    """Decisiones arquitectónicas compartidas del equipo (cualquier miembro del diagrama)."""
    require_ai_access(db, diagram_id, current_user, READ_ROLES)
    return await service.get_shared_memory(diagram_id=str(diagram_id))


@router.get("/audit-feed/{diagram_id}")
async def get_audit_feed(
    diagram_id: int,
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    service: AIAgentService = Depends(get_ai_service),
) -> List[Dict[str, Any]]:
    """Muro cronológico de actividad visible por los miembros del diagrama."""
    require_ai_access(db, diagram_id, current_user, READ_ROLES)
    return await service.get_audit_feed(diagram_id=str(diagram_id), limit=limit)


@router.post("/audit-feed/{diagram_id}")
async def create_audit_log_event(
    diagram_id: int,
    event: AuditEventCreate,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    service: AIAgentService = Depends(get_ai_service),
) -> Dict[str, Any]:
    """Registra un evento en la bitácora. El autor es siempre el usuario autenticado."""
    require_ai_access(db, diagram_id, current_user, WRITE_ROLES)
    return await service.log_manual_audit_event(
        diagram_id=str(diagram_id),
        actor=display_name(current_user),
        action_summary=event.action_summary,
    )
