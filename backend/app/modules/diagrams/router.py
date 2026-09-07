import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Body, Depends
from fastapi.responses import FileResponse

from app.core.dependencies import get_model_service, get_storage_service
from app.core.errors import (
    ComponentDiagramUnsupportedError,
    InvalidModelError,
)
from app.modules.diagrams.schemas import GenerateRequest
from app.modules.diagrams.schemas import ValidationResultResponse
from app.modules.diagrams.service import ModelService
from app.core.storage import StorageService

router = APIRouter(prefix="/api/v1/models", tags=["models"])


@router.post("/validate", response_model=ValidationResultResponse)
def validate_model(
    data: dict[str, Any] = Body(...),
    model_service: ModelService = Depends(get_model_service),
) -> ValidationResultResponse:
    _, result = model_service.validate_model(data)
    return result


@router.post("/generate")
def generate_project(
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
    model_service: ModelService = Depends(get_model_service),
    storage_service: StorageService = Depends(get_storage_service),
) -> FileResponse:
    uml_model, validation_result = model_service.validate_model(request.model_data)

    if not validation_result.is_valid or uml_model is None:
        raise InvalidModelError(
            errors=[err.model_dump() for err in validation_result.errors]
        )

    # Restricción F9: La generación Spring Boot no soporta diagramas de componentes
    if (
        len(uml_model.components) > 0
        or len(uml_model.interfaces) > 0
        or len(uml_model.ports) > 0
        or len(uml_model.connectors) > 0
    ):
        raise ComponentDiagramUnsupportedError(
            details={
                "components": len(uml_model.components),
                "interfaces": len(uml_model.interfaces),
                "connectors": len(uml_model.connectors),
            }
        )

    zip_path, _checksum, warnings = model_service.generate_project(
        uml_model=uml_model,
        project_name=request.project_name,
        package_name=request.package_name,
        output_base=storage_service.base_output_dir,
    )

    # Programar borrado del directorio temporal que contiene el ZIP (el padre del ZIP)
    background_tasks.add_task(storage_service.cleanup_path, zip_path.parent)

    # Añadir los warnings en los headers (o usar StreamingResponse/Custom Response)
    # Como queremos descargar el archivo, devolvemos FileResponse
    headers = {}
    if warnings:
        headers["X-Generation-Warnings"] = json.dumps(
            [w.model_dump() for w in warnings]
        )

    return FileResponse(
        path=zip_path,
        filename=f"{request.project_name}.zip",
        media_type="application/zip",
        headers=headers,
    )
