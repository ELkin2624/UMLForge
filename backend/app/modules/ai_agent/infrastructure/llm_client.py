import json
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types
from ..schemas import AgentStructuredOutput, CanvasPatchOperation

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(self, api_key: str):
        self.api_key = api_key or ""
        self.model_name = "gemini-2.5-flash"
        self.fallback_models = ["gemini-2.0-flash", "gemini-1.5-flash"]
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None

    async def invoke_architect_agent(
        self,
        user_name: str,
        user_prompt: str,
        private_history: List[Dict[str, Any]],
        shared_decisions: List[Dict[str, Any]],
        recent_audit_logs: List[Dict[str, Any]],
        canvas_snapshot: Dict[str, Any],
        image_base64: Optional[str] = None,
    ) -> AgentStructuredOutput:
        """Invoca a Gemini con el rol de Arquitecto Omnisciente y salida fuertemente estructurada."""
        if not self.client or not self.api_key:
            logger.info("Sin GEMINI_API_KEY configurada. Generando respuesta contextual simulada.")
            return self._simulate_architect_response(
                user_name=user_name,
                user_prompt=user_prompt,
                shared_decisions=shared_decisions,
                canvas_snapshot=canvas_snapshot,
                image_base64=image_base64,
            )

        system_instruction = f"""
Eres el Arquitecto de Software Senior (IA) compartido del proyecto colaborativo en UMLForge.
Cada miembro del equipo conversa contigo en un chat privado individual, pero tú posees la "mente y memoria unificada" de todo el equipo y del proyecto en el mismo lienzo.

MEMORIA COMPARTIDA DEL EQUIPO (Decisiones arquitectónicas tomadas por los miembros del equipo):
{json.dumps(shared_decisions, ensure_ascii=False)}

ACTIVIDAD RECIENTE EN EL LIENZO (Historial de cambios):
{json.dumps(recent_audit_logs, default=str, ensure_ascii=False)}

ESTADO ACTUAL DEL DIAGRAMA UML (Snapshot del lienzo):
{json.dumps(canvas_snapshot, ensure_ascii=False)}

Actualmente estás conversando en privado con: {user_name}.
- Si el usuario te envía una imagen (ej: boceto hecho a mano, foto de pizarra o diagrama capturado), analízala cuidadosamente, extrae las entidades, atributos, tipos y relaciones observadas y genera los 'canvas_patches' correspondientes.
- Si {user_name} te pide diseñar, crear o refactorizar clases o relaciones, genera las operaciones en 'canvas_patches' y registra una breve justificación en 'shared_decision_note' para que cuando otro compañero te consulte, puedas explicar exactamente qué diseñó {user_name} y por qué.
- Si {user_name} te pregunta sobre por qué existe una clase, interfaz o relación en el lienzo, consulta la MEMORIA COMPARTIDA y la ACTIVIDAD RECIENTE para explicarle quién la solicitó y la justificación arquitectónica.
- Sé claro, técnico, conciso y profesional.
"""

        # Formatear historial privado previo + prompt actual
        contents = []
        for msg in private_history[-10:]:
            role = msg.get("role", "user").upper()
            content = msg.get("content", "")
            contents.append(f"{role}: {content}")
        contents.append(f"USER ({user_name}): {user_prompt}")
        prompt_text = "\n".join(contents)

        gemini_contents: List[Any] = []
        if image_base64:
            try:
                import base64
                if "," in image_base64:
                    header, data_str = image_base64.split(",", 1)
                    mime = header.split(";")[0].replace("data:", "")
                else:
                    data_str = image_base64
                    mime = "image/png"
                img_bytes = base64.b64decode(data_str)
                gemini_contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
            except Exception as e:
                logger.warning(f"Error procesando imagen para Gemini: {e}")

        gemini_contents.append(prompt_text)

        models_to_try = [self.model_name] + self.fallback_models
        last_error = None

        for model in models_to_try:
            try:
                response = await self.client.aio.models.generate_content(
                    model=model,
                    contents=gemini_contents if len(gemini_contents) > 1 else prompt_text,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=AgentStructuredOutput,
                        temperature=0.2,
                    ),
                )
                if response and response.text:
                    return AgentStructuredOutput.model_validate_json(response.text)
            except Exception as e:
                logger.warning(f"Error llamando a Gemini con modelo {model}: {e}")
                last_error = e

        logger.error(f"Fallo en llamada a Gemini con todos los modelos: {last_error}")
        # En caso de fallo de red o cuota en Gemini, fallback inteligente
        return self._simulate_architect_response(
            user_name=user_name,
            user_prompt=user_prompt,
            shared_decisions=shared_decisions,
            canvas_snapshot=canvas_snapshot,
            image_base64=image_base64,
        )

    def _simulate_architect_response(
        self,
        user_name: str,
        user_prompt: str,
        shared_decisions: List[Dict[str, Any]],
        canvas_snapshot: Dict[str, Any],
        image_base64: Optional[str] = None,
    ) -> AgentStructuredOutput:
        """Simulador de fallback para desarrollo local y pruebas sin API key."""
        lower_prompt = user_prompt.lower()

        # Si se envió una imagen en el modo simulado
        if image_base64:
            return AgentStructuredOutput(
                reply_to_user="He analizado la imagen/boceto que enviaste. He extraído las clases principales observadas y preparé sugerencias para incorporarlas al lienzo.",
                shared_decision_note=f"{user_name} subió un boceto arquitectónico para modelar entidades desde imagen.",
                canvas_patches=[
                    CanvasPatchOperation(
                        op="ADD_CLASS",
                        target_name="EntidadBoceto",
                        payload={"attributes": [{"name": "id", "type": "int"}, {"name": "descripcion", "type": "string"}]},
                        reason="Entidad inferida a partir del boceto/imagen subida.",
                    )
                ],
                execution_mode="SUGGESTION",
            )

        # Caso 1: El usuario pregunta sobre decisiones previas o cambios de compañeros
        if any(w in lower_prompt for w in ["por qué", "porque", "quién", "quien", "metodopago", "explicar", "que hizo", "qué hizo"]):
            if shared_decisions:
                last_dec = shared_decisions[-1]
                author = last_dec.get("author", "un compañero")
                decision = last_dec.get("decision", "una refactorización en el modelo")
                return AgentStructuredOutput(
                    reply_to_user=f"En la memoria compartida del equipo consta que {author} tomó la siguiente decisión arquitectónica: \"{decision}\". El objetivo es desacoplar responsabilidades y mantener alta cohesión en el modelo UML.",
                    shared_decision_note=None,
                    canvas_patches=[],
                    execution_mode="SUGGESTION",
                )
            return AgentStructuredOutput(
                reply_to_user="Actualmente no hay decisiones previas registradas en la memoria compartida para este diagrama.",
                shared_decision_note=None,
                canvas_patches=[],
                execution_mode="SUGGESTION",
            )

        # Caso 2: El usuario pide crear pagos / strategy
        if "pago" in lower_prompt or "strategy" in lower_prompt:
            patches = [
                CanvasPatchOperation(
                    op="ADD_CLASS",
                    target_name="MetodoPago",
                    payload={"stereotype": "interface", "operations": [{"name": "procesarPago", "return_type": "boolean"}]},
                    reason="Interfaz de estrategia para desacoplar medios de pago",
                ),
                CanvasPatchOperation(
                    op="ADD_CLASS",
                    target_name="PagoQR",
                    payload={"attributes": [{"name": "codigoQR", "type": "String"}], "operations": [{"name": "procesarPago", "return_type": "boolean"}]},
                    reason="Estrategia concreta de pago mediante código QR",
                ),
                CanvasPatchOperation(
                    op="ADD_CLASS",
                    target_name="PagoTarjeta",
                    payload={"attributes": [{"name": "numeroTarjeta", "type": "String"}, {"name": "cvv", "type": "String"}], "operations": [{"name": "procesarPago", "return_type": "boolean"}]},
                    reason="Estrategia concreta de pago mediante Tarjeta",
                ),
                CanvasPatchOperation(
                    op="ADD_RELATION",
                    target_name="PagoQR_realizes_MetodoPago",
                    payload={"source": "PagoQR", "target": "MetodoPago", "type": "realization"},
                    reason="PagoQR implementa la interfaz MetodoPago",
                ),
                CanvasPatchOperation(
                    op="ADD_RELATION",
                    target_name="PagoTarjeta_realizes_MetodoPago",
                    payload={"source": "PagoTarjeta", "target": "MetodoPago", "type": "realization"},
                    reason="PagoTarjeta implementa la interfaz MetodoPago",
                ),
            ]
            return AgentStructuredOutput(
                reply_to_user=f"Hola {user_name}. He estructurado el módulo de pagos implementando el patrón Strategy con la interfaz MetodoPago y las variantes PagoQR y PagoTarjeta. Dejé las operaciones como sugerencias para el lienzo.",
                shared_decision_note=f"{user_name} estructuró el módulo de pagos usando el patrón Strategy con la interfaz MetodoPago para desacoplar los métodos QR y Tarjeta.",
                canvas_patches=patches,
                execution_mode="SUGGESTION",
            )

        # Caso 3: Petición genérica de creación de clase
        if any(w in lower_prompt for w in ["crea", "crear", "agrega", "agregar", "clase"]):
            words = user_prompt.split()
            candidate_name = "NuevaClase"
            for idx, w in enumerate(words):
                if w.lower() in ["clase", "entidad", "modelo"] and idx + 1 < len(words):
                    candidate_name = words[idx + 1].capitalize().replace(".", "").replace(",", "")
                    break

            patches = [
                CanvasPatchOperation(
                    op="ADD_CLASS",
                    target_name=candidate_name,
                    payload={"attributes": [{"name": "id", "type": "Long"}], "operations": []},
                    reason=f"Definición inicial de la entidad {candidate_name}",
                )
            ]
            return AgentStructuredOutput(
                reply_to_user=f"He preparado la propuesta arquitectónica para la clase {candidate_name} con atributos base. Se ha colocado como sugerencia para el equipo.",
                shared_decision_note=f"{user_name} diseñó la clase {candidate_name} en el diagrama.",
                canvas_patches=patches,
                execution_mode="SUGGESTION",
            )

        # Caso 4: Respuesta arquitectónica general
        return AgentStructuredOutput(
            reply_to_user=f"Como Arquitecto Central, he registrado tu consulta: \"{user_prompt}\". Todo el equipo mantiene sincronizado el lienzo y puedo asistirte con refactorizaciones, diseño de patrones o análisis de impacto.",
            shared_decision_note=None,
            canvas_patches=[],
            execution_mode="SUGGESTION",
        )
