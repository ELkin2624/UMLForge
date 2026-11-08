# UMLForge — Guía general para agentes

UMLForge es una herramienta CASE colaborativa: se modela en UML (diagrama de clases y de componentes), se valida el modelo y se genera un proyecto Spring Boot funcional (con SQL, colección Postman y validación E2E). También soporta XMI 2.5.1, colaboración en tiempo real, voz y un agente de IA.

## Qué es el proyecto

Proyecto del curso **Software 1** (parcial/examen). La idea central: el usuario dibuja un modelo UML y la herramienta lo convierte en software funcional, en vez de ser solo un editor de diagramas.

Flujo principal:

```
Entrada (editor visual / voz / foto)
   -> Modelo canónico (CanonicalModel)
   -> Validación estructural y semántica
   -> Domain Analyzer -> Dependency Graph -> Synthetic Data Generator
   -> Salidas: proyecto Spring Boot + JPA, data.sql, OpenAPI, colección Postman,
      esquema móvil (schema.json, ai-tools.json), XMI 2.5.1
   -> Despliegue local (Docker + Maven) y validación E2E (Newman)
```

Capacidades:

| Capacidad | Dónde vive |
|---|---|
| Editor UML de clases y de componentes | `frontend` (Apollon) + `adapters/` |
| Validación de modelos | `backend/app/core/validators`, `POST /api/v1/models/validate` |
| **Diseño de datos**: modelo conceptual → lógico, normalización 1FN–FNBC demostrable, diagrama de BD | `backend/app/modules/data_design`; `frontend/features/data-design` |
| Generación Spring Boot / SQL / OpenAPI / Postman | `backend/app/modules/generator`, `postman` |
| Importar/exportar XMI 2.5.1 (perfil Enterprise Architect) | `backend/app/modules/xmi`, `docs/xmi_ea_profile.md` |
| Despliegue local y validación E2E | `backend/app/modules/deployment`, `e2e` |
| Cuentas, compartir con roles, invitaciones, notificaciones (PostgreSQL) | `auth`, `sharing`, `notifications` |
| Diagramas en **MongoDB** + **historial de versiones** (quién hizo qué, ver, restaurar) | `backend/app/modules/diagram_store`, `diagrams`; `frontend/features/versioning` |
| Colaboración en tiempo real (Yjs) y presencia | `frontend/features/collaboration` + `infra/collaboration-server` |
| Voz (Whisper local + intérprete de comandos) | `backend/modules/voice`, `frontend/features/voice` |
| Agente de IA grupal (Gemini, memoria privada y compartida en MongoDB) | `backend/modules/ai_agent`, `frontend/features/ai-assistant` |
| **App móvil de solo lectura** (Expo): login, proyectos, visor de diagramas, versiones, análisis, IA, notificaciones | `mobile/` |

## Estado actual (a 2026-11-02)

Historial: 11 commits, del 2026-08-30 al 2026-10-29. Las fases del plan (`docs/plan-definicion.md`) llegan hasta la **Fase 10 (XMI)**; el commit `e36e7fb` dice "proyecto terminado creo".

**Funciona (según el repo):**
- Pipeline completo modelo -> proyecto Spring Boot -> Postman con datos sintéticos, con relaciones 1:1, 1:N, N:M, composición, agregación y herencia, e integridad referencial en `data.sql`.
- Diagramas de clases y de componentes (Fase 9) y XMI 2.5.1 (Fase 10).
- Reportes E2E reales: 7 corridas en `backend-springboot/` entre 2026-09-22 y 2026-09-29.
- Auth con JWT + refresh, CRUD de diagramas, compartir con roles `OWNER`/`EDITOR`/`READER`, invitaciones y notificaciones.
- **Diagramas en MongoDB con control de versiones** (2026-11-02): autoguardado, historial con autor (usuario o IA), vista previa de versiones pasadas y restauración. Requiere `alembic upgrade head` (migración `a7c1e5b09d42`).
- Colaboración Yjs con presencia, cursores y selecciones.
- **Último hito (2026-10-29): "IA grupal"**. Endpoint `/api/v1/ai/collaborate`: cada usuario conversa en privado con el agente, que además comparte una memoria de decisiones arquitectónicas del equipo y un feed de auditoría. Devuelve parches canónicos listos para el lienzo y Yjs, con sugerencias en un overlay.
- Migraciones Alembic aplicadas (2). Hay 44 archivos de tests en el backend y varios `*.test.ts` en el frontend.

**Incompleto o pendiente:**
- **Diseño de datos** (2026-11-02): implementado (modelo lógico, normalización con dependencias inferidas + confirmadas por el usuario, diagrama BD). Pendientes dentro de este bloque: la "medición" del diseño y el diagrama de secuencia (sin definir con el profesor), y aplicar la descomposición propuesta al diagrama de clases (hoy solo se muestra).
- Pendientes de los parciales: notificaciones push en el móvil, IA/voz sin internet.
- **App móvil** (2026-11-04): visor de solo lectura en `mobile/` (Expo SDK 58). Reemplaza al antiguo "Golden Template"/workspace de runtime dinámico, que se eliminó. Sin edición: ni crear, renombrar, borrar, compartir ni restaurar; los parches de la IA se muestran pero no se aplican. Solo escribe estado de cuenta (marcar notificaciones, aceptar/rechazar invitaciones). Verificada con `tsc`, ESLint, 15 tests y `expo export`; **sin probar aún en un dispositivo real**.
- El generador (`backend/app/modules/generator`) todavía produce `schema.json`/`ai-tools.json`/`manifest.json` para el móvil antiguo; hoy ninguna app los consume.
- `docs/obsidian/01_Project_Brain.md` está desactualizado: lista como "próximos pasos" la verificación manual del Modal de Compartir y la IA local móvil (AURA), y no menciona la IA grupal ni XMI. AURA (`03_Estrategia_IA_Local_AURA.md`) es una estrategia sin implementación visible en backend/frontend.
- La IA grupal es muy reciente (último commit): sin evidencia de tests más allá de `tests/test_ai_agent.py`; trátala como la zona menos estable.
- El servidor Yjs no persiste el Y.Doc (en memoria). La persistencia real es el autoguardado en MongoDB. Sí valida el token contra FastAPI antes de unir a una sala (`server.js`); el README del servidor está desactualizado en ese punto.
- Hay un solo workflow de CI (E2E); no hay CI de tests unitarios ni del frontend.
- En el último commit se borró `backend-examen/` y la salida generada pasó a `backend-springboot/` (**no** está en `.gitignore`: sus 81 archivos están versionados; decide si debe ignorarse).

**Cuando trabajes aquí**, asume que el proyecto está en fase de **estabilización y cierre**, no de construcción desde cero: prioriza arreglar, limpiar y probar sobre añadir funcionalidades nuevas, salvo que se pida.

## Estructura del monorepo

| Carpeta | Qué es | Guía |
|---|---|---|
| `backend/` | API FastAPI (Python 3.11), PostgreSQL + MongoDB | `backend/AGENTS.md` |
| `frontend/` | SPA React 19 + Vite + Apollon (editor UML) | `frontend/AGENTS.md`, `frontend/DESIGN.md` |
| `infra/collaboration-server/` | Servidor WebSocket Yjs (en memoria; valida el token contra FastAPI) | `infra/collaboration-server/README.md` |
| `backend-springboot/` | **Salida generada** por el backend (proyectos Spring Boot y reportes E2E). No editar a mano | — |
| `mobile/` | App Expo (expo-router) de solo lectura para ver diagramas | `mobile/AGENTS.md` |
| `docs/` | `plan-definicion.md`, `xmi_ea_profile.md`, `obsidian/` (reglas y arquitectura) | — |

Antes de tocar un área, lee la guía de su carpeta. Las reglas de arquitectura de fondo están en `docs/obsidian/02_Reglas_y_Arquitectura.md`.

## Levantar el entorno

```bash
docker compose up -d                                  # Postgres :5437, Mongo :27017
cd backend && source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --port 8000             # docs en /docs
cd frontend && npm install && npm run dev             # Vite, proxy /api -> :8000
cd infra/collaboration-server && npm install && npm start   # ws :1234 — NECESARIO para colaborar
```

Sin el servidor Yjs (:1234) el panel de colaboración muestra "Error" a los ~8 s y nadie ve a nadie; el backend (:8000) también debe estar arriba porque el servidor Yjs valida cada token contra él.

Puertos: backend 8000, frontend 5173, Yjs 1234, Postgres 5437 (el contenedor expone 5437 -> 5432; `POSTGRES_PORT` del `.env` debe ser 5437), Mongo 27017.

## Principios (resumen de `docs/obsidian`)

- Clean Code, DRY, KISS, SOLID. No sobre-ingenierizar.
- Backend: arquitectura modular vertical / hexagonal; el dominio no depende de frameworks.
- Frontend: Feature-Sliced Design (`features/`, `widgets/`, `shared/`).
- **No reconstruir semántica**: las relaciones se derivan del `CanonicalModel` y de la estrategia real de persistencia generada.
- IDs sintéticos (Postman y `data.sql`) deben ser trazables y respetar integridad referencial; no inyectar `id = 1` arbitrario.

## Contrato frontend ↔ backend

- Prefijo de API: `/api/v1`. Auth con JWT de acceso (15 min) + refresh en cookie HttpOnly.
- **Compartir**: dos vías, ambas validadas por el backend. (1) Invitar a un usuario (notificación + aceptar). (2) Enlace "cualquier persona con el enlace": `PUT /diagrams/{id}/share-link` (solo OWNER) crea un token secreto con rol EDITOR/READER; quien abre `/?join=<token>` con sesión iniciada llama `POST /share-links/{token}/join` y recibe el permiso. Los enlaces antiguos `?room=&token=` ya no conceden nada (el token se inventaba en el navegador). El servidor Yjs valida el permiso en cada conexión (`4001` sesión inválida, `4003` sin permiso) y **descarta las escrituras de los `READER`**. El propietario puede activar al agente de IA como participante de la sala (`diagrams.agent_enabled`, migración `e5b2d9a14c70`; requiere `alembic upgrade head`).
- Los diagramas se guardan en **MongoDB**, no en PostgreSQL. PostgreSQL conserva solo la fila índice `diagrams` (id, name, owner_id, fechas) por las FK de permisos e invitaciones. Ver `backend/AGENTS.md`.
- El modelo UML viaja en formato canónico (`backend/app/core/canonical_model`, espejo en `frontend/src/types/canonical-model.ts`). Si cambias uno, cambia el otro.
- Roles de diagrama: `OWNER`, `EDITOR`, `READER` (ver `frontend/src/features/sharing/model/capabilities.ts` y el módulo `sharing` del backend).

## Reglas de trabajo

- No hagas commit ni push sin que te lo pidan.
- No subas `.env`, claves (`GEMINI_API_KEY`, `COHERE_API_KEY`, `JWT_SECRET`) ni salidas de `backend-springboot/`.
- Responde y comenta en español, igual que el código existente.
- Cambios mínimos y enfocados: no refactorices código ajeno a la tarea.
- CI: `.github/workflows/e2e-validation.yml` (Python 3.12, Java 21, Maven, Node) ejecuta la validación E2E en push/PR a `main`.
