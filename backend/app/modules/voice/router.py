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
    genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")

# Inicialización diferida / global del modelo de transcripción
# Usamos "tiny" con int8 y 4 hilos de CPU para transcripción casi instantánea (< 0.5s)
whisper_model = None

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        logger.info("Inicializando modelo Whisper local ultra-rápido (tiny, int8, 4 threads)...")
        whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8", cpu_threads=4)
    return whisper_model

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe un archivo de audio (.webm/.wav) a texto usando faster-whisper local (tiny)."""
    temp_path = None
    try:
        content = await audio.read()
        if not content or len(content) < 50:
            return TranscribeResponse(text="")

        model = get_whisper_model()
        
        # Guardar en archivo temporal
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            temp_audio.write(content)
            temp_path = temp_audio.name
            
        # Transcribir con beam_size=1 y filtro VAD para respuesta instantánea
        segments, info = model.transcribe(temp_path, beam_size=1, language="es", vad_filter=True)
        text = " ".join([segment.text for segment in segments]).strip()
        
        return TranscribeResponse(text=text)
    except Exception as e:
        logger.error(f"Error transcribiendo audio con Whisper: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al transcribir el audio: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


SYSTEM_PROMPT = """
Eres un analizador de intenciones para una herramienta CASE de modelado UML (conforme al estándar OMG UML 2.5+).
Tu tarea es traducir texto natural (que puede provenir de voz transcrita por Whisper o de texto escrito por el usuario) en un array JSON estructurado de comandos UML para aplicarse sobre el diagrama.

Reglas estrictas de interpretación:
1. SOLO debes devolver un objeto JSON con la propiedad "commands" que sea un arreglo de comandos.
2. Los tipos de comando válidos son estrictamente: CREATE_CLASS, RENAME_CLASS, ADD_ATTRIBUTE, CREATE_RELATIONSHIP, DELETE_CLASS.
3. Limpieza de nombres y comillas:
   - Si el usuario dice "con el nombre 'Rol'", "llamada 'Rol'", o "con el nombre de rol", el nombre de la clase es "Rol" (PascalCase).
   - NUNCA uses preposiciones, artículos o palabras de enlace ("Con", "De", "Para", "La", "El", "Tabla", "Clase") como nombre de clase.
   - Remueve comillas simples o dobles de los nombres ('Rol' -> Rol).
4. Corrección de errores acústicos y fonéticos de Whisper:
   - "mucho jamucho", "muchos jamuchos", "mucho a mucho", "muchos a muchos", "muchos con muchos" -> Relación de muchos a muchos (* a *).
   - Concordancia con clases existentes: Si el usuario dice "tabla usuaria", "clase clientes", "producto", busca y concilia con las clases ya existentes en el lienzo (ej. "Usuario", "Cliente", "Producto").
   - Tipos de datos: mapea "char", "cadena", "texto", "varchar" a "string"; "entero", "int", "id" a "number" o "integer"; "flotante", "float", "double", "precio" a "number"; "fecha" a "date"; "booleano" a "boolean".
5. Si el texto no contiene comandos UML válidos o no tiene sentido, devuelve `{"commands": []}`.

Regla Especial de Descomposición Muchos a Muchos (M:N / * a *):
- Cuando el usuario solicite una relación muchos a muchos entre dos clases (ClaseA y ClaseB):
  Debes descomponerla creando:
  1. Si ClaseA no existe aún, su CREATE_CLASS (y sus atributos solicitados).
  2. La clase intermedia con el nombre unificado en PascalCase (ej: `{"type": "CREATE_CLASS", "className": "ClaseAClaseB"}`).
  3. Los atributos de llave foránea en la clase intermedia (ej: `{"type": "ADD_ATTRIBUTE", "className": "ClaseAClaseB", "attributeName": "claseAId", "attributeType": "number"}`, `{"type": "ADD_ATTRIBUTE", "className": "ClaseAClaseB", "attributeName": "claseBId", "attributeType": "number"}`).
  4. Dos relaciones 1 a * hacia la clase intermedia:
     - `{"type": "CREATE_RELATIONSHIP", "sourceClass": "ClaseA", "targetClass": "ClaseAClaseB", "relationshipType": "ASSOCIATION", "sourceMultiplicity": "1", "targetMultiplicity": "*"}`
     - `{"type": "CREATE_RELATIONSHIP", "sourceClass": "ClaseB", "targetClass": "ClaseAClaseB", "relationshipType": "ASSOCIATION", "sourceMultiplicity": "1", "targetMultiplicity": "*"}`

Esquema de comandos válidos:
- CREATE_CLASS: {"type": "CREATE_CLASS", "className": "NombreClase"}
- RENAME_CLASS: {"type": "RENAME_CLASS", "oldClassName": "Viejo", "newClassName": "Nuevo"}
- ADD_ATTRIBUTE: {"type": "ADD_ATTRIBUTE", "className": "NombreClase", "attributeName": "nombreAttr", "attributeType": "string" | "number" | "boolean" | "date"}
- CREATE_RELATIONSHIP: {"type": "CREATE_RELATIONSHIP", "sourceClass": "Origen", "targetClass": "Destino", "relationshipType": "ASSOCIATION" | "INHERITANCE" | "COMPOSITION" | "AGGREGATION" | "DEPENDENCY", "sourceMultiplicity": "1" | "*", "targetMultiplicity": "1" | "*"}
- DELETE_CLASS: {"type": "DELETE_CLASS", "className": "NombreClase"}

Devuelve EXCLUSIVAMENTE un JSON válido estructurado como `{"commands": [...]}`. No agregues comillas invertidas ni bloques de markdown.
"""

try:
    import cohere
except ImportError:
    cohere = None

def parse_with_gemini(prompt: str) -> List[Any]:
    model = genai.GenerativeModel(
        model_name="gemini-3.6-flash", 
        generation_config={"response_mime_type": "application/json"}
    )
    response = model.generate_content(prompt)
    content = response.text.strip()
    data = json.loads(content)
    if isinstance(data, list):
        return data
    return data.get("commands", [])

def parse_with_cohere(prompt: str) -> List[Any]:
    if not cohere:
        raise RuntimeError("El paquete 'cohere' no está instalado en el entorno.")
    client = cohere.ClientV2(api_key=settings.COHERE_API_KEY)
    res = client.chat(
        model="command-r-plus-08-2024",
        messages=[
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    content = res.message.content[0].text.strip()
    data = json.loads(content)
    if isinstance(data, list):
        return data
    return data.get("commands", [])

@router.post("/parse-intent", response_model=ParseIntentResponse)
async def parse_intent(request: ParseIntentRequest):
    if not settings.GEMINI_API_KEY and not settings.COHERE_API_KEY:
        raise HTTPException(
            status_code=422,
            detail="Ni GEMINI_API_KEY ni COHERE_API_KEY están configuradas en el entorno."
        )

    prompt = f"{SYSTEM_PROMPT}\n\n"
    if request.initial_context:
        prompt += f"Contexto Inicial (Clase Activa sugerida): {request.initial_context}\n"
    
    # Pasamos los nombres de clases existentes para que el LLM sepa qué existe
    existing_classes = []
    if request.current_model and "classes" in request.current_model:
        existing_classes = [c.get("name") for c in request.current_model.get("classes", []) if c.get("name")]
    
    if existing_classes:
        prompt += f"Clases existentes en el lienzo: {', '.join(existing_classes)}\n"
        
    prompt += f"\nTexto a analizar: {request.text}"

    errors: List[str] = []

    # 1. Intentar proveedor principal: Gemini
    if settings.GEMINI_API_KEY:
        try:
            logger.info("Intentando análisis de intención con Gemini 3.6 Flash...")
            commands = parse_with_gemini(prompt)
            return ParseIntentResponse(commands=commands)
        except Exception as e:
            logger.warning(f"Gemini API falló ({e}). Activando fallback a Cohere...")
            errors.append(f"Gemini: {e}")

    # 2. Fallback automático al proveedor secundario: Cohere
    if settings.COHERE_API_KEY:
        try:
            logger.info("Ejecutando análisis de intención con Cohere API...")
            commands = parse_with_cohere(prompt)
            logger.info("Análisis con Cohere completado exitosamente.")
            return ParseIntentResponse(commands=commands)
        except Exception as e:
            logger.error(f"Cohere API falló ({e}).")
            errors.append(f"Cohere: {e}")

    raise HTTPException(
        status_code=500,
        detail=f"Fallaron todos los proveedores de IA disponibles: {' | '.join(errors)}"
    )
