from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any


class CanvasPatchOperation(BaseModel):
    op: Literal["ADD_CLASS", "UPDATE_CLASS", "DELETE_CLASS", "ADD_RELATION", "DELETE_RELATION"]
    target_name: str = Field(description="Nombre de la clase o relación afectada")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Atributos, métodos, estereotipos o extremos de la relación")
    reason: str = Field(description="Breve justificación arquitectónica del cambio")


class AgentStructuredOutput(BaseModel):
    reply_to_user: str = Field(description="Respuesta directa para el chat privado del usuario")
    shared_decision_note: Optional[str] = Field(
        default=None,
        description="Si se tomó una decisión de diseño relevante para el equipo, resúmela aquí",
    )
    canvas_patches: List[CanvasPatchOperation] = Field(default_factory=list)
    execution_mode: Literal["DIRECT", "SUGGESTION"] = "SUGGESTION"


class CollaborateRequest(BaseModel):
    diagram_id: str
    user_id: str
    user_name: str
    prompt: str
    image_base64: Optional[str] = Field(
        default=None,
        description="Imagen en base64 (ej: boceto, captura o diagrama) para análisis multimodal",
    )
    current_canvas_snapshot: Dict[str, Any] = Field(
        default_factory=dict,
        description="Estado actual del JSON del diagrama UML",
    )


class CollaborateResponse(BaseModel):
    reply: str
    patches: List[Dict[str, Any]] = Field(default_factory=list)
    execution_mode: Literal["DIRECT", "SUGGESTION"] = "SUGGESTION"
    shared_decision_note: Optional[str] = None


class AuditEventCreate(BaseModel):
    actor: str
    action_summary: str
