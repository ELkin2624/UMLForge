from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.errors import APIError, ComponentDiagramUnsupportedError
from app.modules.deployment.router import router as deployment_router
from app.modules.diagrams.router import router as diagrams_router
from app.modules.e2e.router import router as e2e_router
from app.modules.health.router import router as health_router
from app.modules.xmi.router import router as xmi_router
from app.modules.auth.router import router as auth_router
from app.modules.diagrams.crud_router import router as diagram_crud_router
from app.modules.sharing.router import router as sharing_router
from app.modules.notifications.router import router as notifications_router
from app.modules.voice.router import router as voice_router

app = FastAPI(
    title="Herramienta CASE API",
    description="API para validación y generación de proyectos Spring Boot desde modelos UML",
    version="0.1.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(diagram_crud_router)
app.include_router(sharing_router)
app.include_router(notifications_router)
app.include_router(diagrams_router)
app.include_router(deployment_router)
app.include_router(e2e_router)
app.include_router(xmi_router)
app.include_router(voice_router)


# Exception Handlers
@app.exception_handler(ComponentDiagramUnsupportedError)
async def component_unsupported_handler(
    request: Request, exc: ComponentDiagramUnsupportedError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
        },
    )


@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    content = {
        "status": exc.status_code,
        "detail": exc.message,
        "errors": getattr(exc, "errors", []),
    }
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = []
    for err in exc.errors():
        loc = ".".join([str(x) for x in err["loc"]])
        errors.append(
            {
                "code": "request_validation_error",
                "message": err["msg"],
                "path": loc,
                "severity": "error",
            }
        )

    return JSONResponse(
        status_code=422,
        content={"status": 422, "detail": "Invalid Request Format", "errors": errors},
    )
