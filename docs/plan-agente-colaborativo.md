> Implementación actual: [Agente colaborador](agente-colaborativo.md). Este documento conserva el plan histórico; la autoridad de escritura pasó al coordinador del servidor y las tareas son persistentes. MCP externo sigue fuera del alcance.

# Plan: agente de IA como colaborador del diagramador

Basado en la auditoría del repo (HEAD `59b9fc8`). Se **adapta** lo existente; no se reconstruye nada.

## Avance

| Fase | Estado | Notas |
|---|---|---|
| A. Seguridad `/ai/*` | Hecha | Token, rol por diagrama, límites y rate limit. |
| 1. Motor de comandos + undo | Hecha | Deshacer/rehacer solo cubre cambios aprobados desde el panel de IA; sin atajos de teclado. |
| 2. Aprobación vía Yjs + vista previa | Hecha | Vista previa textual (no resalta en el lienzo). Límite conocido: el modelo es un JSON completo en un `Y.Map` (último en escribir gana), así que dos clientes que escriban al mismo tiempo por red aún pueden pisarse; la huella evita el caso habitual (cambio ya recibido) pero no la carrera de red. |
| 3. Contexto y selección | Hecha | El backend lee el diagrama del almacén (`context_service.py`) y arma un resumen con presupuesto de 3000 tokens (`context_builder.py`). Incluye validación y formas normales. La copia del cliente solo es respaldo. Los cambios de OTROS usuarios aparecen cuando ellos autoguardan (~3 s); los propios se guardan antes de preguntar. |
| 4 a 9 | Pendientes | |

## Decisiones de partida (cambiar si no te convencen)

- **Proveedor:** Ollama/Qwen entra como **alternativa local** detrás de una interfaz `LLMProvider`. Gemini sigue disponible por configuración (`AI_PROVIDER=gemini|ollama`). Se decide el reemplazo definitivo tras medir calidad en la Fase 4.
- **Autoridad de las operaciones:** el motor de comandos sigue en el frontend (`features/uml-commands`), porque el modelo vive en Yjs/Apollon. El backend **valida y firma** las propuestas (esquema, permisos, tamaño), pero no escribe el diagrama.
- **El LLM nunca escribe:** solo propone *comandos tipados*. Humano y agente ejecutan las mismas operaciones.
- Cada fase termina con pruebas en verde y un commit propio. No se empieza la siguiente sin cerrar la anterior.

## Mapa de lo existente que se reutiliza

| Pieza | Archivo |
|---|---|
| Motor de comandos (idempotencia, huellas, inversos) | `frontend/src/features/uml-commands/engine.ts`, `fingerprint.ts`, `types.ts` |
| Traducción parche → comandos | `frontend/src/features/ai-assistant/model/patch-to-commands.ts` |
| Sugerencias y aprobación | `ai-assistant/model/ai-store.ts`, `ui/AISuggestionsOverlay.tsx` |
| Presencia del agente | `infra/collaboration-server/src/agent-presence.js`, `frontend/src/features/collaboration/model/awareness.ts` |
| Permisos | `backend/app/core/auth_deps.py` (`require_diagram_access`, `require_diagram_role`), `capabilities.ts` |
| Memoria, auditoría | `backend/app/modules/ai_agent/infrastructure/nosql_repository.py` |
| Versiones | `backend/app/modules/diagram_store`, `frontend/src/features/versioning` |
| Voz | `backend/app/modules/voice/router.py`, `frontend/src/features/voice` |

---

## Fase A — Cerrar seguridad de `/api/v1/ai/*` (prerrequisito)

**Problema:** sin autenticación, `user_id` viene del cuerpo/query y no se comprueba acceso al diagrama.

**Trabajo**
1. `ai_agent/router.py`: todos los endpoints con `Depends(require_diagram_access)` (el `diagram_id` pasa a `int`; hoy es `str`). `user_id` y `user_name` se derivan del token, se eliminan del cuerpo y de la query.
2. `collaborate` exige rol `EDITOR`/`OWNER`; `READER` puede leer historial propio pero no pedir parches.
3. Actualizar `frontend/src/features/ai-assistant/api/ai-api.ts` (dejar de enviar `user_id`).
4. Migrar datos de Mongo existentes (`diagram_id` string) o aceptar ambos en lectura.
5. Límites: tamaño de `image_base64` y de `current_canvas_snapshot`, rate limit por usuario.

**Archivos:** `ai_agent/router.py`, `schemas.py`, `service.py`, `ai-api.ts`, `backend/tests/test_ai_agent.py` (hoy asume uso anónimo; se reescribe con `conftest` autenticado).

**Aceptación:** sin token → 401; token de usuario sin acceso al diagrama → 403/404; `READER` no obtiene parches; un usuario no puede leer el historial de otro.
**Pruebas:** API con 3 usuarios (owner, editor, reader, ajeno).

## Fase 1 — Motor de comandos completo

1. Completar `patchToCommands` para todas las operaciones del esquema: `UPDATE_CLASS`, `DELETE_RELATION`, y operaciones de atributo (hoy solo `ADD_CLASS`, `ADD_RELATION`, `DELETE_CLASS`). Alinear `CanvasPatchOperation` (backend) con `types.ts` (frontend) en un único catálogo de operaciones.
2. **Rellenar `expected`** (huellas) al traducir: el parche guarda las huellas de los elementos que toca en el momento de la propuesta.
3. **Pila Undo/Redo** (`uml-commands/history.ts`): usa los `inverse` que ya calcula el motor; entradas etiquetadas con autor (usuario o IA). Atajos Ctrl+Z / Ctrl+Y y botones en `TopMenuBar`. Undo solo de lo propio (nunca deshace cambios ajenos).
4. Reglas de validación del motor: nombres duplicados, referencias huérfanas, tipos válidos (reutilizar `backend/app/core/validators` como espejo de reglas).

**Aceptación:** cada operación tiene prueba de aplicar, repetir (idempotente), invertir y conflicto de huella.
**Pruebas:** vitest en `engine.test.ts`, `patch-to-commands.test.ts`, nuevo `history.test.ts`.

## Fase 2 — Aprobación segura y aplicación vía Yjs

1. `approveSuggestion` deja de hacer `setModel(modeloCompleto)`: aplica los comandos sobre el estado actual en **una transacción Yjs** (`ydoc.transact`), verificando `expected`. Si hay conflicto → no aplica, marca el parche como `stale` y pide al agente re-proponer.
2. Estado de parche: `pending_approval → approved | rejected | stale | applied`. Persistir en `ai_suggestions` y en auditoría.
3. **Vista previa:** al seleccionar una sugerencia, el overlay resalta en el lienzo los elementos afectados (agregar/modificar/eliminar con colores) sin tocar el modelo.
4. Aprobar varios parches como lote atómico (todo o nada).
5. Quitar la respuesta simulada silenciosa: `LLMClient` devuelve error explícito o un campo `simulated: true` que la UI muestra.

**Aceptación:** dos usuarios editan la misma clase mientras hay una sugerencia pendiente → la sugerencia queda `stale`, nunca pisa el cambio ajeno. Aprobar dos veces no duplica.
**Pruebas:** vitest con dos `Y.Doc` sincronizados en memoria.

## Fase 3 — Contexto del diagrama y de la selección

1. `CollaborateRequest` añade `selection` (ids/nombres de elementos seleccionados) tomada del awareness local.
2. Serializador compacto del modelo (`backend/.../context_builder.py`): clases, atributos, claves, relaciones, multiplicidades en formato resumido; presupuesto de tokens y truncado con aviso.
3. **El backend lee el diagrama de MongoDB** (`diagram_store/repository.py`), no confía en el snapshot del cliente. Se envía solo `version` del cliente para detectar desfase.
4. Incluir resultado de validación (`uml_validator`) y análisis de `data_design` (normalización) como contexto opcional.

**Aceptación:** "mejora esta tabla" con una clase seleccionada recibe solo ese contexto + vecinas; el contexto respeta el presupuesto.
**Pruebas:** unitarias del `context_builder` con `backend/examples/*.json`.

## Fase 4 — Proveedor local (Ollama + Qwen) y tool calling

1. Interfaz `LLMProvider` (`ai_agent/infrastructure/providers/base.py`) con `chat(messages, tools) -> respuesta`; implementaciones `gemini.py` (código actual extraído de `llm_client.py`) y `ollama.py` (HTTP a `OLLAMA_BASE_URL`, API `/api/chat` con `tools`).
2. Configuración en `core/config.py`: `AI_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, timeouts. Compose opcional con servicio `ollama` en `docker-compose.yml`.
3. **Orquestador** (`ai_agent/orchestrator.py`): bucle acotado (máx. N pasos) *leer contexto → llamar herramientas de lectura → proponer*. Herramientas iniciales, todas tipadas con Pydantic:
   - Lectura: `get_diagram_summary`, `get_class(name)`, `list_relationships`, `validate_model`, `analyze_normalization`.
   - Propuesta: `propose_add_class`, `propose_update_class`, `propose_add_attribute`, `propose_add_relationship`, `propose_delete_*`. Solo **devuelven parches**; no ejecutan.
4. Validación de salida: cualquier parche con esquema inválido se descarta y se reintenta una vez; nunca se ejecuta SQL ni texto libre del modelo.
5. Banco de evaluación (`backend/tests/ai_eval/`): 20–30 prompts en español con resultado esperado, para comparar Gemini vs Qwen (tasa de JSON válido, aciertos, latencia). Con eso se decide si Qwen puede ser principal.

**Aceptación:** con `AI_PROVIDER=ollama` el flujo completo funciona sin internet; con provider caído → mensaje claro, sin simulación.
**Pruebas:** proveedor falso (stub) para CI; evaluación real manual con Ollama local.

## Fase 5 — MCP

Solo tras cerrar la 4. El servidor MCP es una **fachada** sobre las mismas herramientas del orquestador, no una segunda implementación.

1. `backend/app/modules/mcp_server/` (SDK Python de MCP, transporte stdio/HTTP) exponiendo las herramientas de lectura y de propuesta.
2. Autenticación con el mismo token y mismas verificaciones de la Fase A; sin herramientas de escritura directa.
3. El orquestador puede consumir las herramientas por MCP o directamente (flag); por defecto directo, MCP para clientes externos.

**Aceptación:** un cliente MCP externo lista herramientas, propone un cambio y este aparece como sugerencia pendiente en el lienzo.

## Fase 6 — Agente como participante: identidad, cursor y acciones visibles

1. **Identidad:** avatar/color propios (ya hay `AGENT_USER` en `agent-presence.js`), nombre configurable.
2. **Estado del agente** en awareness: `idle | thinking | proposing | applying`, y `target` (id de elemento). `AIPresenceIndicator` ya existe como base.
3. **Cursor virtual** (`features/collaboration/ui/AgentCursor.tsx`): se anima (CSS/rAF) hacia el nodo objetivo, parpadea al "seleccionar", sigue un arrastre cuando la operación es mover. Es **solo representación**: la operación real sigue siendo el comando aprobado; el cursor se dispara por eventos del ciclo de ejecución, nunca al revés.
4. **Escritura por el agente:** al aprobar, el cambio se aplica con `origin = agentId` en la transacción Yjs y se atribuye a la IA en versiones y auditoría (`markAiChange` ya existe). Ejecuta quien aprueba, el agente "actúa" visualmente.
5. Todos los clientes ven la animación (se sincroniza vía awareness); `prefers-reduced-motion` la desactiva.

**Aceptación:** al aprobar, todos los usuarios ven al agente moverse, seleccionar y la clase aparecer; el cursor nunca altera datos.
**Pruebas:** unitarias del estado de awareness; verificación manual con dos navegadores.

## Fase 7 — Voz (STT local, TTS opcional)

1. Unificar el motor de voz con el agente: la transcripción (`/voice/transcribe`) se envía como prompt al orquestador; los comandos simples siguen resolviéndose con el intérprete de reglas existente (rápido, sin LLM).
2. Corregir la inconsistencia de modelo Whisper (`tiny` en backend vs `base` mostrado en `whisper-engine.ts`), configurable por entorno.
3. TTS opcional con `speechSynthesis` del navegador (sin dependencias nuevas); interruptor en el chat.
4. Confirmación hablada: el agente lee su propuesta y el usuario aprueba con botón o voz ("aplícalo"), pasando siempre por el flujo de la Fase 2.

**Aceptación:** dictar "agrega edad a Cliente" → propuesta visible → aprobar → aplicado; todo en español y sin internet con Ollama.

## Fase 8 — Conflictos, permisos finos, auditoría y reversión

1. Política de conflicto documentada: huellas obsoletas → `stale`; el agente puede re-proponer sobre el estado nuevo, nunca forzar.
2. Permisos: el propietario decide el alcance del agente (solo sugerir / puede proponer borrados / desactivado). Nuevo campo en `diagrams` con migración Alembic; el servidor Yjs y el backend lo respetan.
3. Auditoría completa: quién pidió, qué propuso, quién aprobó, qué se aplicó, con `patch_id`, modelo/proveedor y versión del diagrama. Visible en `AuditFeedTab`.
4. Reversión: "deshacer cambios de la IA" por lote usando el historial de la Fase 1, y restauración de versión como respaldo.
5. Protecciones: tope de operaciones por propuesta, confirmación reforzada para borrados, sanitización de prompts/respuestas, sin exponer claves.

**Aceptación:** sobre un conjunto de operaciones destructivas, ninguna se aplica sin aprobación explícita; todo es reversible.

## Fase 9 — Pruebas, rendimiento y despliegue

1. **CI:** nuevo workflow que ejecuta `pytest`, `vitest`, `eslint`/`tsc` del frontend y `node --test` del servidor Yjs (hoy solo corre E2E).
2. Integración: escenario de 3 usuarios + agente (Playwright o script con `y-websocket`) para conflicto, aprobación y reversión.
3. Rendimiento: diagramas de 50/200 clases; medir tamaño de contexto, latencia de Qwen por tamaño y tiempo de aplicación de lote; fijar presupuestos.
4. Despliegue: servicio `ollama` en compose con modelo precargado, variables en `.env.example`, guía de requisitos de hardware, health check del proveedor en `/health`.
5. Documentación: actualizar `AGENTS.md`, `docs/obsidian/01_Project_Brain.md`, README del servidor Yjs; archivar o borrar la estrategia AURA (otro producto).

## Resumen y orden

| # | Fase | Dependencia | Riesgo si se omite |
|---|---|---|---|
| A | Seguridad `/ai/*` | — | Fuga de chats, uso anónimo del LLM |
| 1 | Motor completo + undo | A | IA limitada a 3 operaciones |
| 2 | Aprobación vía Yjs + preview | 1 | La IA pisa cambios ajenos |
| 3 | Contexto + selección | A | Respuestas genéricas |
| 4 | Ollama/Qwen + tools | 2, 3 | Sin IA local |
| 5 | MCP | 4 | Opcional |
| 6 | Cursor virtual y presencia | 2 | Cosmético |
| 7 | Voz + TTS | 4 | Opcional |
| 8 | Conflictos/permisos/reversión | 1, 2 | Cambios irreversibles |
| 9 | Pruebas, CI, despliegue | todas | Regresiones |

Las fases 3 y 1 pueden avanzar en paralelo tras la A; 5, 6 y 7 son independientes entre sí.

## Riesgos y mitigación

- **Qwen local genera JSON/herramientas inválidas:** validación Pydantic, un reintento, banco de evaluación antes de decidir; Gemini como respaldo configurable.
- **Latencia en CPU:** contexto compacto, streaming de la respuesta, límite de pasos del orquestador.
- **Desfase entre Yjs y Mongo:** el backend lee la última versión guardada y la compara con la `version` del cliente; las huellas protegen la aplicación final.
- **Alcance:** el `AGENTS.md` pide estabilizar; si hay poco tiempo, A + 1 + 2 + 3 + 4 dan un agente seguro y útil, y 5–7 se difieren.
