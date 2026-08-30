from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from services.api.config import settings
from services.api.routers import deployment, e2e, health, models
from services.api.schemas.errors import APIError, ComponentDiagramUnsupportedError

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
app.include_router(health.router)
app.include_router(models.router)
app.include_router(deployment.router)
app.include_router(e2e.router)


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
