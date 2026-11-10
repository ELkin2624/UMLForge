import json
import logging
from typing import Any, Dict, List, Optional

import httpx
from google import genai
from google.genai import types

from .tool_provider import gemini_models

from ..schemas import (
    PAYLOAD_CONTRACT,
    AgentResult,
    AgentStructuredOutput,
    CanvasPatchOperation,
)

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(
        self,
        api_key: str,
        provider: str = "gemini",
        ollama_base_url: str = "http://127.0.0.1:11434",
        ollama_model: str = "qwen3.5:4b",
        ollama_timeout_seconds: float = 180.0,
        ollama_api_token: str = "",
    ):
        self.api_key = api_key or ""
        self.provider = provider
        models = gemini_models()
        self.model_name = models[0]
        self.fallback_models = models[1:]
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.ollama_model = ollama_model
        self.ollama_timeout_seconds = ollama_timeout_seconds
        self.ollama_api_token = ollama_api_token

    async def invoke_architect_agent(
        self,
        user_name: str,
        user_prompt: str,
        private_history: List[Dict[str, Any]],
        shared_decisions: List[Dict[str, Any]],
        recent_audit_logs: List[Dict[str, Any]],
        canvas_snapshot: Dict[str, Any],
        image_base64: Optional[str] = None,
        diagram_context: str = "",
    ) -> AgentResult:
        """Invoca el proveedor configurado con salida fuertemente estructurada."""
        if self.provider == "gemini" and (not self.client or not self.api_key):
            raise RuntimeError("Gemini no está configurado.")

        system_instruction = f"""
Eres el Arquitecto de Software Senior (IA) compartido del proyecto colaborativo en UMLForge.
Cada miembro del equipo conversa contigo en un chat privado individual, pero tú posees la "mente y memoria unificada" de todo el equipo y del proyecto en el mismo lienzo.

MEMORIA COMPARTIDA DEL EQUIPO (Decisiones arquitectónicas tomadas por los miembros del equipo):
{json.dumps(shared_decisions, ensure_ascii=False)}

ACTIVIDAD RECIENTE EN EL LIENZO (Historial de cambios):
{json.dumps(recent_audit_logs, default=str, ensure_ascii=False)}

ESTADO ACTUAL DEL DIAGRAMA UML (resumen; las clases se identifican por NOMBRE):
{diagram_context or json.dumps(canvas_snapshot, ensure_ascii=False)}

Actualmente estás conversando en privado con: {user_name}.
- Si el usuario te envía una imagen (ej: boceto hecho a mano, foto de pizarra o diagrama capturado), analízala cuidadosamente, extrae las entidades, atributos, tipos y relaciones observadas y genera los 'canvas_patches' correspondientes.
- Si {user_name} te pide diseñar, crear o refactorizar clases o relaciones, genera las operaciones en 'canvas_patches' y registra una breve justificación en 'shared_decision_note' para que cuando otro compañero te consulte, puedas explicar exactamente qué diseñó {user_name} y por qué.
- Una orden explícita de crear, agregar, modificar o eliminar usa execution_mode DIRECT. Una pregunta de opinión, propuesta o pedido ambiguo usa SUGGESTION y no afirma haber aplicado cambios.
- Si pide un sistema o base de datos de forma amplia, interpreta el dominio y propone un modelo UML útil con clases, atributos tipados y relaciones razonables; explica brevemente tus supuestos. Si falta información indispensable, pregunta.
- COBERTURA OBLIGATORIA: convierte CADA elemento solicitado en una operación. Una petición con varias clases exige un ADD_CLASS por clase; los atributos pedidos deben ir en el payload de su clase; cada relación pedida exige su propio ADD_RELATION. No resumas varias entidades en una sola clase ni describas en 'reply_to_user' algo que no esté también en 'canvas_patches'.
- Antes de responder, revisa que todos los nombres, atributos y relaciones explícitos del pedido estén cubiertos por los parches. Si falta información indispensable, pregunta en 'reply_to_user' y no inventes requisitos no solicitados.
- Si {user_name} te pregunta sobre por qué existe una clase, interfaz o relación en el lienzo, consulta la MEMORIA COMPARTIDA y la ACTIVIDAD RECIENTE para explicarle quién la solicitó y la justificación arquitectónica.
- Si el resumen incluye una SELECCIÓN DEL USUARIO, interpreta "esto", "esta tabla" o "la clase seleccionada" como esos elementos.
- Si el resumen indica que parte del diagrama se omitió por tamaño, dilo y no inventes lo que no ves.
- Operaciones disponibles en 'canvas_patches' y su 'payload': {PAYLOAD_CONTRACT}
- Usa UPDATE_CLASS (no DELETE_CLASS + ADD_CLASS) para renombrar o cambiar atributos de una clase existente.
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

        if self.provider == "ollama":
            return await self._invoke_ollama(
                system_instruction,
                prompt_text,
                user_name=user_name,
                user_prompt=user_prompt,
                shared_decisions=shared_decisions,
                canvas_snapshot=canvas_snapshot,
            )

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
                    parsed = AgentStructuredOutput.model_validate_json(response.text)
                    return AgentResult(**parsed.model_dump(), simulated=False)
            except Exception as e:
                logger.warning(f"Error llamando a Gemini con modelo {model}: {e}")
                last_error = e

        logger.error(f"Fallo en llamada a Gemini con todos los modelos: {last_error}")
        raise RuntimeError("No se pudo consultar Gemini.") from last_error

    async def _invoke_ollama(
        self,
        system_instruction: str,
        prompt_text: str,
        *,
        user_name: str,
        user_prompt: str,
        shared_decisions: List[Dict[str, Any]],
        canvas_snapshot: Dict[str, Any],
    ) -> AgentResult:
        """Usa la API local de Ollama y valida estrictamente su JSON de salida."""
        try:
            parsed = await self._ollama_structured_response(system_instruction, prompt_text)
            if self._needs_attribute_repair(parsed, user_prompt):
                logger.warning(
                    "Ollama propuso clases sin atributos pese a que el usuario los solicitó; reintentando"
                )
                repair_prompt = (
                    f"{prompt_text}\n\nCORRECCIÓN OBLIGATORIA: tu salida anterior creó una o más "
                    "clases sin atributos. Devuelve de nuevo el JSON completo. Cada ADD_CLASS debe "
                    "incluir payload.attributes con todos los atributos pedidos. No dejes payload vacío."
                )
                parsed = await self._ollama_structured_response(system_instruction, repair_prompt)
            if self._needs_attribute_repair(parsed, user_prompt):
                parsed.reply_to_user += " No pude completar los atributos solicitados; revisa la propuesta antes de aplicarla."
                parsed.execution_mode = "SUGGESTION"
            return AgentResult(**parsed.model_dump(), simulated=False)
        except Exception as exc:
            logger.error("Error llamando a Ollama local (%s): %s", self.ollama_base_url, exc)
            raise RuntimeError("No se pudo consultar Ollama.") from exc

    async def _ollama_structured_response(
        self, system_instruction: str, prompt_text: str
    ) -> AgentStructuredOutput:
        """Ejecuta una consulta local y convierte su JSON al contrato del agente."""
        payload = {
            "model": self.ollama_model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt_text},
            ],
            "format": AgentStructuredOutput.model_json_schema(),
            "stream": False,
            # Qwen3 activa razonamiento por defecto: en CPU puede tardar minutos
            # y producir texto extra que invalida el contrato JSON.
            "think": False,
            "options": {"temperature": 0.2, "num_predict": 700},
        }
        headers = (
            {"Authorization": f"Bearer {self.ollama_api_token}"}
            if self.ollama_api_token
            else None
        )
        async with httpx.AsyncClient(timeout=self.ollama_timeout_seconds) as client:
            response = await client.post(
                f"{self.ollama_base_url}/api/chat", json=payload, headers=headers
            )
            response.raise_for_status()
        content = response.json().get("message", {}).get("content")
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Ollama no devolvió contenido de chat")
        return AgentStructuredOutput.model_validate_json(content)

    @staticmethod
    def _needs_attribute_repair(output: AgentStructuredOutput, user_prompt: str) -> bool:
        """Evita aceptar cajas vacías cuando el pedido sí incluía atributos."""
        asks_for_attributes = any(
            word in user_prompt.lower() for word in ("atributo", "propiedad", "campo")
        )
        return asks_for_attributes and any(
            patch.op == "ADD_CLASS" and not patch.payload.get("attributes")
            for patch in output.canvas_patches
        )

    @staticmethod
    def _as_simulated(output: AgentStructuredOutput) -> AgentResult:
        """El respaldo local nunca se hace pasar por una respuesta real del modelo."""
        return AgentResult(**output.model_dump(), simulated=True)

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
