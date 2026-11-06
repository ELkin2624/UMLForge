import json
from pydantic import BaseModel, Field, field_validator
from typing import List, Literal, Optional, Dict, Any

MAX_PROMPT_CHARS = 4_000
MAX_IMAGE_CHARS = 8_000_000  # ~6 MB de imagen en base64
MAX_SNAPSHOT_BYTES = 500_000

# Contrato de `payload` por operación. Lo interpreta frontend/src/features/ai-assistant/
# model/patch-to-commands.ts; si cambias uno, cambia el otro.
PAYLOAD_CONTRACT = (
    "Según la operación: "
    "ADD_CLASS {attributes:[{name,type,visibility?}], operations:[{name,return_type}]}; "
    "UPDATE_CLASS {new_name?, add_attributes:[{name,type}], "
    "update_attributes:[{name,new_name?,type?,visibility?}], remove_attributes:[nombre]}; "
    "DELETE_CLASS {}; "
    "ADD_RELATION {source,target,type?,source_multiplicity?,target_multiplicity?}; "
    "DELETE_RELATION {source,target,type?}. "
    "Las clases se identifican por NOMBRE (target_name o source/target)."
)


class CanvasPatchOperation(BaseModel):
    op: Literal["ADD_CLASS", "UPDATE_CLASS", "DELETE_CLASS", "ADD_RELATION", "DELETE_RELATION"]
    target_name: str = Field(description="Nombre de la clase o relación afectada")
    payload: Dict[str, Any] = Field(
        default_factory=dict,
        description=PAYLOAD_CONTRACT,
    )
    reason: str = Field(description="Breve justificación arquitectónica del cambio")


class AgentStructuredOutput(BaseModel):
    reply_to_user: str = Field(description="Respuesta directa para el chat privado del usuario")
    shared_decision_note: Optional[str] = Field(
        default=None,
        description="Si se tomó una decisión de diseño relevante para el equipo, resúmela aquí",
    )
    canvas_patches: List[CanvasPatchOperation] = Field(default_factory=list)
    execution_mode: Literal["DIRECT", "SUGGESTION"] = "SUGGESTION"


class AgentResult(AgentStructuredOutput):
    """Salida del agente + procedencia. El esquema que ve el modelo sigue siendo
    AgentStructuredOutput: `simulated` lo fija el servidor, nunca el LLM."""

    simulated: bool = False


class CollaborateRequest(BaseModel):
    """El usuario NO viaja en el cuerpo: se deriva siempre del token."""

    diagram_id: int
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_CHARS)
    image_base64: Optional[str] = Field(
        default=None,
        max_length=MAX_IMAGE_CHARS,
        description="Imagen en base64 (ej: boceto, captura o diagrama) para análisis multimodal",
    )
    current_canvas_snapshot: Dict[str, Any] = Field(
        default_factory=dict,
        description="Copia del diagrama del cliente. Solo se usa de RESPALDO: el contexto sale del almacén.",
    )
    selection: List[str] = Field(
        default_factory=list,
        max_length=20,
        description="Ids (o nombres) de los elementos que el usuario tiene seleccionados",
    )

    @field_validator("selection")
    @classmethod
    def _clip_selection(cls, value: List[str]) -> List[str]:
        return [str(v)[:100] for v in value]

    @field_validator("current_canvas_snapshot")
    @classmethod
    def _limit_snapshot(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        if len(json.dumps(value, default=str)) > MAX_SNAPSHOT_BYTES:
            raise ValueError("El diagrama es demasiado grande para enviarlo a la IA")
        return value


class CollaborateResponse(BaseModel):
    reply: str
    patches: List[Dict[str, Any]] = Field(default_factory=list)
    execution_mode: Literal["DIRECT", "SUGGESTION"] = "SUGGESTION"
    shared_decision_note: Optional[str] = None
    simulated: bool = False
    context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Metadatos del contexto usado: fuente, versión, tamaño y si se recortó",
    )


class AuditEventCreate(BaseModel):
    """El autor se deriva del token; solo se acepta el resumen."""

    action_summary: str = Field(min_length=1, max_length=1_000)
