# Backend — Guía para agentes

API en **FastAPI** (Python >= 3.11) con arquitectura modular vertical. Valida modelos UML, genera proyectos Spring Boot, importa/exporta XMI, gestiona usuarios/diagramas/permisos, voz e IA.

## Comandos

```bash
cd backend && source .venv/bin/activate
pip install -r requirements/requirements.txt      # o: pip install -e ".[dev]"
cp -n .env.example .env                           # primera vez
alembic upgrade head                              # migraciones
uvicorn app.main:app --reload --port 8000         # Swagger: /docs
pytest                                            # tests (pythonpath = "."); no necesitan Mongo ni Docker
ruff check . && black --check . && mypy app       # calidad (mypy strict)
alembic revision --autogenerate -m "mensaje"      # nueva migración
python scripts/run_e2e.py                         # corrida E2E completa (requiere Docker/Maven/Newman)
```

Bases de datos: `docker compose up -d` en la raíz. Postgres queda en **5437**, así que `POSTGRES_PORT=5437` en `.env`. Mongo en 27017.

## Configuración (`app/core/config.py`)

Pydantic Settings, lee `backend/.env`. Obligatorias: `DATABASE_URL`, `JWT_SECRET`. Opcionales: `MONGO_URI`, `MONGO_DB_NAME`, `GEMINI_API_KEY`, `COHERE_API_KEY`, `GOOGLE_CLIENT_*`, `CORS_ORIGINS`, `OUTPUT_DIR` (por defecto `../backend-springboot`).

## Estructura

```
app/
  main.py                 # FastAPI, CORS, routers, handlers; create_all en lifespan
  core/
    canonical_model/      # UMLClass, UMLRelationship... (modelo canónico)
    uml_core/             # enums y constantes (visibilidad, multiplicidad, tipos)
    validators/           # reglas estructurales y semánticas
    database/             # models.py (SQLAlchemy), session.py
    config.py errors.py dependencies.py storage.py
  modules/                # un slice por dominio
    auth, sharing, notifications, diagrams, diagram_store, data_design, xmi,
    generator, postman, deployment, e2e, voice, ai_agent, health
alembic/                  # migraciones
tests/                    # api, canonical_model, e2e_runner, generator, postman_generator, validators, xmi, test_ai_agent.py
```

Cada módulo sigue `router.py` (HTTP) -> `service.py` (lógica) -> `schemas.py` (DTOs Pydantic). Módulos grandes (`generator`, `e2e`, `deployment`, `ai_agent`) añaden `application/`, `domain/`, `infrastructure/`, `executors/` o `utils/`.

Routers registrados en `main.py`: health, auth, users, diagram CRUD, sharing, invitations, notifications, diagrams (validate/generate), deployment, e2e, xmi, voice, ai_agent.

## Diagramas en MongoDB y versiones

- **Dónde vive qué**: PostgreSQL guarda `users`, permisos, invitaciones, notificaciones y la fila índice `diagrams` (sin `data`). MongoDB (`MONGO_DB_NAME`) guarda `diagram_documents` (estado actual) y `diagram_versions` (historial con snapshot completo), además de las colecciones de la IA.
- **`app/modules/diagram_store`**: `DiagramRepository` (interfaz), `MongoDiagramRepository` (`pymongo` síncrono; el CRUD es SQLAlchemy síncrono, por eso no `motor`), `InMemoryDiagramRepository` (tests) y `diff.py` (función pura `diff_models`/`summarize`). Se inyecta con `get_diagram_repo()` (`app/core/dependencies.py`).
- **Guardar** (`PUT /api/v1/diagrams/{id}`): calcula el diff contra el estado actual; **sin diferencias no se crea versión**. `source: "ai"` atribuye la versión a la IA (`on_behalf_of` = usuario que la pidió).
- **Versiones** (`diagrams/versions_router.py`): `GET .../versions`, `GET .../versions/{n}`, `POST .../versions/{n}/restore` (restaurar crea una versión nueva, nunca borra historia; solo OWNER/EDITOR).
- Si Mongo no responde, cualquier endpoint de diagramas devuelve **503** `STORE_UNAVAILABLE` (handler en `main.py`). Los índices se crean de forma perezosa en el primer uso.
- **Migración** `a7c1e5b09d42`: copia `diagrams.data` a Mongo, verifica y recién entonces borra la columna (`downgrade` la restaura). Antes de aplicarla en una base con datos: `docker exec umlforge_postgres pg_dump -U umlforge umlforge > backup.sql`.
- Los tests (`tests/conftest.py`) sustituyen el almacén por el de memoria de forma automática. Ojo: algunos tests del generador reescriben `mobile/apps/current/`; revisa `git status` tras correr la suite.

## Diseño de datos (`app/modules/data_design`)

- **Modelo lógico** (`logical.py`): reutiliza `EntityMapper` + `SchemaMapper` del generador, así que es exactamente el esquema que genera el backend Spring Boot. Añade claves/FKs estructuradas, aristas del diagrama y las reglas conceptual → lógico (`mappings`).
- **Normalización** (`normalization.py`, funciones puras): cierre de atributos, claves candidatas, verificación 2FN/3FN/FNBC con evidencia, recubrimiento mínimo y síntesis de Bernstein (3FN, sin pérdida y preservando dependencias). 1FN se evalúa aparte (`inference.first_normal_form_issues`).
- **Dependencias funcionales** (`inference.py`): un diagrama de clases no las trae. Se **infieren sugerencias** (atributo con nombre de otra entidad referenciada por FK → dependencia transitiva; dependencia parcial en clave compuesta; clave natural por ≥2 FKs; grupos como `ciudad → pais`), **ninguna se usa hasta que el usuario la acepta**. Las decisiones (`accepted`/`rejected`/`custom`) se guardan en Mongo (`diagram_dependencies`, vía `DiagramRepository.get/save_dependencies`) y **no** se versionan.
- El análisis (`service.analyze`) devuelve la forma normal confirmada y la que resultaría si se aceptaran las sugerencias pendientes.
- Endpoints: `POST /api/v1/data-design/analyze` (recibe el modelo actual, sin necesidad de guardarlo) y `GET|PUT /api/v1/diagrams/{id}/data-design/dependencies` (PUT solo OWNER/EDITOR).
- Límite conocido: la búsqueda exhaustiva de claves candidatas se trunca con más de 16 atributos no esenciales (se avisa en `warnings`).

## Reglas

- Type hints en todo; `mypy --strict`; líneas <= 88 (black/ruff).
- La lógica va en `service.py` o en `domain/`, nunca en el router. El dominio no importa FastAPI ni SQLAlchemy.
- Errores de API con las excepciones de `app/core/errors.py` (`APIError`, `ComponentDiagramUnsupportedError`...). Respuestas de error con `code`, `message`, `details`.
- Todo cambio de esquema = migración Alembic. No dependas de `create_all` (existe solo como red de seguridad en el arranque).
- Generador: plantillas Jinja2 en `modules/generator/templates/`. Derivar relaciones del `CanonicalModel`; no reconstruir semántica. IDs sintéticos trazables en Postman y `data.sql`.
- Los proyectos generados se escriben en `OUTPUT_DIR`; ese directorio es salida, no código fuente.
- Secretos solo por variables de entorno. Nunca registres tokens ni claves en logs.
- Dependencias nuevas: agrégalas a `requirements/requirements.txt` **y** a `pyproject.toml` (deben coincidir).
- Código nuevo = test nuevo en la carpeta de `tests/` correspondiente.

## Trampas conocidas

- `app/modules/e2e` y `deployment` invocan Docker, Maven, Newman y procesos externos; no los ejecutes en tests unitarios.
- `voice` usa `faster-whisper` y `av<14` (pesados; descargan modelos en el primer uso).
- `ai_agent` usa `google-genai` y `cohere`, y guarda estado en MongoDB (`motor`, asíncrono).
- `verify_e2e_new_domain.py` en la raíz de `backend/` es un script suelto de verificación, no parte de la app.
