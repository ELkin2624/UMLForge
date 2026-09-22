import json
import logging
import os
import io
import tempfile
from typing import List, Optional, Any
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import google.generativeai as genai
from app.core.config import settings
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])

class ParseIntentRequest(BaseModel):
    text: str
    current_model: Optional[Any] = None
    initial_context: Optional[str] = None

class ParseIntentResponse(BaseModel):
    commands: List[Any]

class TranscribeResponse(BaseModel):
    text: str

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

# Inicialización diferida / global del modelo de transcripción
# Usamos "base" (o "small") y compute_type="int8" para que consuma menos de 200MB de RAM en backend.
whisper_model = None

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        logger.info("Inicializando modelo Whisper local (base, int8)...")
        whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    return whisper_model

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe un archivo de audio (.webm/.wav) a texto usando faster-whisper local."""
    try:
        model = get_whisper_model()
        
        # Guardar en archivo temporal (faster-whisper prefiere leer de archivo)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            content = await audio.read()
            temp_audio.write(content)
            temp_path = temp_audio.name
            
        # Transcribir
        segments, info = model.transcribe(temp_path, beam_size=5, language="es")
        
        text = " ".join([segment.text for segment in segments]).strip()
        
        # Limpiar temporal
        os.remove(temp_path)
        
        return TranscribeResponse(text=text)
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        raise HTTPException(status_code=500, detail="Error al transcribir el audio")


SYSTEM_PROMPT = """
Eres un analizador de intenciones para una herramienta UML (conforme al estándar OMG UML 2.5+). Tu tarea es traducir texto natural (con posibles errores de transcripción o ruido acústico de Whisper) en un array JSON de comandos estructurados.
El usuario te hablará para crear o modificar un diagrama de clases UML.

Reglas estrictas:
1. SOLO puedes devolver un objeto JSON con la propiedad "commands" que sea un arreglo de comandos.
2. Los tipos de comando válidos son estrictamente: CREATE_CLASS, RENAME_CLASS, ADD_ATTRIBUTE, CREATE_RELATIONSHIP, DELETE_CLASS.
3. Corrige agresivamente los errores tipográficos del usuario (ej: "lastributo" -> atributo, "botos" -> atributos, "triunatura" -> asignatura/atributos).
4. Si el texto no es interpretable como UML o no tiene sentido, devuelve un arreglo vacío `{"commands": []}`. ¡No inventes clases que no fueron pedidas!

Regla Especial de Descomposición Muchos a Muchos (M:N / * a *):
- Si el usuario solicita una relación de "muchos a muchos" (o * a *) entre dos clases (ej. ClaseA y ClaseB):
  Debes descomponerla automáticamente creando:
  1. La clase intermedia con el nombre unificado en PascalCase (ej: `{"type": "CREATE_CLASS", "className": "ClaseAClaseB"}`).
  2. Sus atributos de llave foránea (ej: `{"type": "ADD_ATTRIBUTE", "className": "ClaseAClaseB", "attributeName": "claseAId", "attributeType": "number"}`, `{"type": "ADD_ATTRIBUTE", "className": "ClaseAClaseB", "attributeName": "claseBId", "attributeType": "number"}`).
  3. Dos relaciones 1 a * hacia la clase intermedia:
     - `{"type": "CREATE_RELATIONSHIP", "sourceClass": "ClaseA", "targetClass": "ClaseAClaseB", "relationshipType": "ASSOCIATION", "sourceMultiplicity": "1", "targetMultiplicity": "*"}`
     - `{"type": "CREATE_RELATIONSHIP", "sourceClass": "ClaseB", "targetClass": "ClaseAClaseB", "relationshipType": "ASSOCIATION", "sourceMultiplicity": "1", "targetMultiplicity": "*"}`

Esquema de comandos válidos (debes usar estrictamente estas propiedades):
- CREATE_CLASS: {"type": "CREATE_CLASS", "className": "NombreClase"}
- RENAME_CLASS: {"type": "RENAME_CLASS", "oldClassName": "Viejo", "newClassName": "Nuevo"}
- ADD_ATTRIBUTE: {"type": "ADD_ATTRIBUTE", "className": "NombreClase", "attributeName": "nombreAttr", "attributeType": "tipoAttr"} (tipoAttr suele ser string, number, date, booleano, etc.)
- CREATE_RELATIONSHIP: {"type": "CREATE_RELATIONSHIP", "sourceClass": "Origen", "targetClass": "Destino", "relationshipType": "ASSOCIATION" | "INHERITANCE" | "COMPOSITION" | "AGGREGATION" | "DEPENDENCY", "sourceMultiplicity": "1" | "*", "targetMultiplicity": "1" | "*"}
- DELETE_CLASS: {"type": "DELETE_CLASS", "className": "NombreClase"}

El texto a analizar puede venir en fragmentos o de forma continuada. Si el usuario menciona agregar un atributo ("agrégale precio") y no menciona a qué clase, debes intentar deducirlo del "Contexto Inicial (Clase Activa)". Si no hay contexto inicial, o si hay mucha ambigüedad, no devuelvas comandos.

Devuelve EXCLUSIVAMENTE un JSON válido estructurado como `{"commands": [...]}`. No agregues comillas invertidas ni bloques de markdown.
"""

@router.post("/parse-intent", response_model=ParseIntentResponse)
async def parse_intent(request: ParseIntentRequest):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=422, detail="GEMINI_API_KEY is not configured.")
        
    try:
        model = genai.GenerativeModel(
            model_name="gemini-3.5-flash", 
            generation_config={"response_mime_type": "application/json"}
        )
        
        prompt = f"{SYSTEM_PROMPT}\n\n"
        if request.initial_context:
            prompt += f"Contexto Inicial (Clase Activa sugerida): {request.initial_context}\n"
        
        # Opcionalmente pasamos los nombres de clases existentes para que el LLM sepa qué existe
        existing_classes = []
        if request.current_model and "classes" in request.current_model:
            existing_classes = [c.get("name") for c in request.current_model.get("classes", []) if c.get("name")]
        
        if existing_classes:
            prompt += f"Clases existentes en el lienzo: {', '.join(existing_classes)}\n"
            
        prompt += f"\nTexto a analizar: {request.text}"
        
        response = model.generate_content(prompt)
        content = response.text
        data = json.loads(content)
        
        # Validación mínima del formato
        if "commands" not in data:
            return ParseIntentResponse(commands=[])
            
        return ParseIntentResponse(commands=data["commands"])
    except Exception as e:
        logger.error(f"Error parsing voice intent: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse intent using LLM.")
