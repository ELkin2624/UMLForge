# Estrategia IA Local: AURA (Asistente de Belleza y Moda)

## Enfoque Principal: Adaptativo y Modular
Para implementar **AURA** como un asistente de inteligencia artificial local que corra en *on-device* (edge computing) en cualquier dispositivo móvil, la clave es evaluar las capacidades del hardware (RAM, NPU, GPU) en tiempo de ejecución y ajustar su funcionamiento.

### 1. Niveles de Inferencia (Graceful Degradation)
El sistema seleccionará el modelo adecuado dependiendo del hardware del dispositivo.

- **Nivel 1 (Gama Alta / Flagships): Modelos SLM (Small Language Models)**
  - Modelos tipo Llama 3 (8B) cuantizados (GGUF/Q4 o Q5), Phi-3 Mini, o Gemma 2.
  - Ejecución mediante frameworks locales como llama.cpp, MLC-LLM, o MediaPipe.
  - Razonamiento profundo on-device (consejos personalizados sin lag, procesando imágenes de forma local).

- **Nivel 2 (Gama Media): Modelos Ligeros y Tareas Específicas**
  - Modelos ultraligeros (< 2B parámetros) como Qwen-1.5-0.5B, TinyLlama o MobileNet (para visión).
  - Tareas divididas: un modelo pequeño procesa intención y contexto visual, pero recurre a respuestas pre-cacheadas o reglas heurísticas.

- **Nivel 3 (Gama Baja): Cloud Fallback o Heurísticas + APIs Ligeras**
  - Si el dispositivo no soporta IA generativa en tiempo real, AURA funcionará usando una arquitectura en la nube (Cloud fallback) llamando a servicios backend (FastAPI + Groq/Gemini).
  - La interfaz seguirá sintiéndose rápida mediante animaciones optimizadas y precarga de recomendaciones.

### 2. Privacidad y Datos Locales
- **Zero-Trust AI**: Al ser un asistente de belleza (posiblemente usando la cámara), el análisis de la piel y el rostro debe ejecutarse 100% en el dispositivo siempre que sea posible.
- **RAG Local (Retrieval-Augmented Generation)**: Se puede usar una base de datos vectorial embebida (como SQLite + vss o ChromaLite) para guardar preferencias del usuario, tono de piel, ropa del armario, etc.

### 3. Arquitectura Híbrida y Tecnologías Clave
- **ONNX Runtime / TensorFlow Lite**: Para el procesamiento de imágenes, segmentación de ropa o análisis de subtono de piel (modelos muy optimizados que corren en CPU/NPU).
- **WebNN / WebGPU**: Si AURA se construye como PWA o usa WebView, usar la aceleración nativa del dispositivo.
- **React Native / Flutter con bindings nativos**: Para que el UI se comunique directamente con el motor de inferencia en C++ (ej. react-native-llama).

### 4. Flujo de Trabajo (AURA)
1. Perfilado de Hardware inicial (Benchmarking silente).
2. Descarga progresiva de pesos (Models download manager): El usuario descarga solo los modelos que necesita para ahorrar almacenamiento.
3. Inferencia de intenciones: Procesamiento de voz o texto para recomendar atuendos o rutina de piel.
4. Generación de Respuesta local o Fallback.
