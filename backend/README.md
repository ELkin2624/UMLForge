# UMLForge Backend 🐍

Backend en Python + FastAPI para la herramienta CASE colaborativa **UMLForge**, estructurado bajo una **Arquitectura Modular Vertical (Clean Architecture)**.

## 🏗️ Estructura del Proyecto

```text
backend/
├── app/
│   ├── core/                          # Núcleo de dominio, modelos canónicos, validadores y configuración
│   │   ├── canonical_model/           # Modelos canónicos UML (UMLClass, UMLRelationship, etc.)
│   │   ├── uml_core/                  # Constantes, enums (visibilidad, multiplicidad, tipos)
│   │   ├── validators/                # Reglas de validación estructural y semántica UML
│   │   ├── config.py                  # Variables de entorno y configuración general
│   │   ├── dependencies.py            # Inyección de dependencias compartidas de FastAPI
│   │   ├── errors.py                  # Excepciones base y errores de API
│   │   └── storage.py                 # Servicio abstracto y local de almacenamiento
│   │
│   ├── modules/                       # Dominios de Negocio (Vertical Slices)
│   │   ├── diagrams/                  # Gestión de Diagramas y Modelos UML (/api/v1/models/...)
│   │   │   ├── router.py              # Endpoints: validación y generación
│   │   │   ├── schemas.py             # DTOs Pydantic (Request/Response)
│   │   │   └── service.py             # ModelService
│   │   │
│   │   ├── generator/                 # Motor de Generación de Código (Spring Boot, Postman)
│   │   │   ├── application/           # Caso de uso principal de generación
│   │   │   ├── domain/                # Mappers, entity info, relation info
│   │   │   ├── infrastructure/        # Jinja renderer, filesystem y zip exporter
│   │   │   └── templates/             # Plantillas Jinja2 (Spring Boot, SQL, YAML)
│   │   │
│   │   ├── xmi/                       # Importación / Exportación XMI 2.5.1 (/api/v1/models/...)
│   │   │   ├── router.py              # Endpoints XMI
│   │   │   ├── core/                  # parser, writer, namespaces, id_map
│   │   │   └── profiles/              # Perfil Enterprise Architect
│   │   │
│   │   ├── deployment/                # Orquestación de Despliegue Local (/api/v1/projects/deploy)
│   │   │   ├── router.py              # Endpoints
│   │   │   ├── schemas.py             # DTOs de despliegue
│   │   │   ├── service.py             # DeploymentService
│   │   │   └── utils/                 # Utilidades Docker, Maven, Newman, Process
│   │   │
│   │   ├── e2e/                       # Runner y Reportes E2E (/api/v1/projects/validate-e2e)
│   │   │   ├── router.py              # Endpoints
│   │   │   ├── runner.py              # E2ERunner
│   │   │   └── executors/             # Ejecutores aislados
│   │   │
│   │   ├── postman/                   # Generador de Colecciones Postman
│   │   └── health/                    # Healthcheck (/health)
│   │
│   └── main.py                        # Entrypoint FastAPI
│
├── requirements/                      # Dependencias modulares
│   ├── requirements.txt               # Producción
│   └── dev.txt                        # Desarrollo y testing
│
├── tests/                             # Suite de pruebas automatizadas con pytest
└── pyproject.toml                     # Configuración de herramientas
```

## 🚀 Ejecución y Desarrollo

### 1. Levantar el Servidor FastAPI
```bash
# Desde la carpeta backend/
uvicorn app.main:app --reload --port 8000
```

Documentación interactiva disponible en:
- Swagger UI: `http://localhost:8000/docs`
- Redoc: `http://localhost:8000/redoc`

### 2. Ejecutar Pruebas Automatizadas
```bash
# Desde la carpeta backend/
pytest
```
