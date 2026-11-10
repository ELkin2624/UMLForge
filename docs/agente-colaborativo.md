# Agente colaborador de UMLForge

El agente integrado utiliza herramientas del diagrama; no es un servidor MCP externo. La primera versión edita clases, atributos, operaciones y relaciones, señala clases con su cursor y prepara movimientos u organización del lienzo. Los diagramas de componentes conservan la edición humana; el agente los rechaza explícitamente.

## Arranque

Se necesita Node.js 24 o superior en el servidor de colaboración, Python del backend, PostgreSQL y MongoDB. El modelo Ollama debe anunciar soporte de herramientas (por ejemplo, el `qwen3.5:4b` configurado en este proyecto).

1. Configurar `backend/.env` como antes y levantar las bases de datos.
2. Desde la raíz, ejecutar `python scripts/configure-collaboration.py`. Genera un secreto compartido en `backend/.env` e `infra/collaboration-server/.env`, ignorados por Git; no lo imprime.
3. Iniciar FastAPI. El trabajador arranca en su lifespan; no necesita un broker adicional.
4. En `infra/collaboration-server`, ejecutar `npm install` y `npm start`. El comando carga su `.env` local.
5. Iniciar el frontend y activar el agente como propietario desde Colaboración.

`COLLAB_INTERNAL_URL` del backend apunta al servidor Yjs; `BACKEND_URL` de colaboración apunta a FastAPI. Las operaciones internas requieren `COLLAB_SERVICE_TOKEN`. El navegador nunca recibe ese secreto. Ollama se configura mediante `AI_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` y las variables existentes. Gemini sigue disponible por configuración explícita.

## Uso

El panel muestra el proveedor real y permite verificarlo. El agente interviene únicamente cuando se le pide. Cada solicitud selecciona **Sugerir** (valor inicial) o **Editar**. El modelo no puede cambiar ese modo.

- **Sugerir:** prepara un lote persistente con vista previa y espera aprobación de OWNER/EDITOR.
- **Editar:** aplica cambios permitidos al finalizar la preparación. Cualquier eliminación, incluso dentro de una actualización de clase, deja pendiente el lote completo.
- El cursor y la selección los publica el servidor; todos los participantes los reciben en coordenadas del lienzo. No se controla la cámara ni el puntero del usuario.
- Las tareas continúan al cerrar el navegador. Se pueden cancelar, rechazar, volver a proponer tras un fallo o conflicto y deshacer si sus elementos no fueron modificados después. Deshacer se limita a las tareas solicitadas por la persona autenticada.
- El chat y las respuestas son privados. Las propuestas y resultados se comparten; la memoria registra decisiones cuando se aplican cambios, no al proponerlos. Las respuestas simuladas dejaron de utilizarse ante fallos del proveedor.

## Coordinación y recuperación

El paquete `packages/uml-commands` contiene el motor TypeScript compartido. Node 24 ejecuta sus módulos directamente; Vite los consume desde el mismo origen. Los modelos canónicos mantienen el mismo contrato; sus tipos frontend se reexportan desde el paquete.

Los navegadores envían lotes con identificador, revisión base y precondiciones por elemento. FastAPI autentica, comprueba permisos y pide al motor el resultado del lote. MongoDB confirma modelo, posiciones, revisión e historial pendiente mediante compare-and-set de un único documento. Los cambios sobre elementos distintos pueden combinarse; los conflictos devuelven 409 y el editor conserva el cambio rechazado para revisión. Los reemplazos completos antiguos requieren `expected_revision`.

Yjs distribuye snapshots confirmados, posiciones y presencia. Para salas numéricas ya no acepta escrituras directas del documento desde navegadores, ni presencia que suplante al agente. Las salas antiguas no numéricas conservan su funcionamiento local anterior.

Un fallo al publicar no revierte una confirmación persistida: el trabajador vuelve a publicar el último snapshot. La proyección del historial es idempotente; un reinicio entre confirmación y publicación no duplica versiones. Las colecciones nuevas son `agent_runs` y `agent_leases`. Los documentos existentes usan su versión actual y posiciones vacías hasta recibir posiciones; no hay nuevas columnas de PostgreSQL ni migración Alembic en este cambio.

El trabajador usa leases renovables por diagrama. Se limita a ocho rondas y diez minutos de generación por defecto. Las propuestas pendientes no caducan por esperar aprobación. Si un trabajador reinicia, recupera la tarea y comprueba si su lote ya fue confirmado antes de repetir una escritura. Si el proveedor o coordinador falla, se muestra el error.

## Interfaces

- `POST /api/v1/diagrams/{id}/commands`: `{batch_id, base_revision, commands}` → `{data, layout, revision, inverse, batch_id}`.
- `GET /api/v1/diagrams/{id}/commands/{batch_id}`: recupera la confirmación de un lote propio si se perdió la respuesta HTTP.
- `POST /api/v1/ai/runs`: `{diagram_id, prompt, mode, request_id, selection?, image_base64?}` → tarea aceptada (202).
- `GET /api/v1/ai/runs?diagram_id=...` y `GET /api/v1/ai/runs/{id}`: tareas compartidas, con respuesta privada solo para el solicitante.
- `POST /api/v1/ai/runs/{id}/{approve|reject|cancel|undo|retry}`: acciones autenticadas.
- `GET /api/v1/ai/provider`: disponibilidad y capacidad de herramientas del proveedor configurado.

`/ai/collaborate` permanece como consulta compatible para móvil: devuelve propuestas, sin aplicarlas ni registrarlas como decisiones aceptadas. La app móvil continúa siendo de solo lectura.

## Pruebas

Backend: ejecutar los tests de comandos, tareas, acceso y versiones. Definir `UMLFORGE_TEST_MONGO_URI` para incluir recuperación, leases y tareas sobre una base temporal con nombre exclusivo, eliminada al terminar.

Frontend: `npm test` y `npm run build`. Colaboración: `npm test` en su carpeta. Las pruebas verifican conflictos, aprobación de eliminaciones internas, cursor compartido, suplantación de presencia, permisos y publicación por revisión. Las evaluaciones con Ollama real dependen del modelo y recursos disponibles; un proveedor falso en tests no demuestra su calidad lingüística.
