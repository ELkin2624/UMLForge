from pathlib import Path
from typing import Any

from e2e_runner.config import E2EConfig
from e2e_runner.models import E2EResult
from e2e_runner.runner import GLOBAL_E2E_LOCK, E2ERunner
from fastapi import APIRouter, Body, Depends, HTTPException

from services.api.dependencies import get_model_service, get_storage_service
from services.api.schemas.errors import InvalidModelError
from services.api.services.model_service import ModelService
from services.api.services.storage import StorageService

router = APIRouter(prefix="/api/v1/projects", tags=["e2e"])


def get_e2e_runner(
    storage_service: StorageService = Depends(get_storage_service),
) -> E2ERunner:
    config = E2EConfig(output_dir=storage_service.base_output_dir)
    return E2ERunner(config=config, lock=GLOBAL_E2E_LOCK)


@router.post("/validate-e2e", response_model=E2EResult)
def validate_project_e2e(
    data: dict[str, Any] = Body(...),
    runner: E2ERunner = Depends(get_e2e_runner),
    model_service: ModelService = Depends(get_model_service),
) -> E2EResult:
    """
    Ejecuta el pipeline E2E completo (Validación, Generación, Docker Postgres, Maven, Spring Boot, Newman).
    Retorna el informe estructurado E2EResult.
    """
    # Concurrencia: verificar si el lock global está disponible
    if not GLOBAL_E2E_LOCK.acquire(blocking=False):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DEPLOYMENT_IN_PROGRESS",
                "message": "Ya existe una validación o despliegue en ejecución.",
            },
        )

    try:
        uml_model, validation_result = model_service.validate_model(data)
        if not validation_result.is_valid or uml_model is None:
            raise InvalidModelError(
                errors=[err.model_dump() for err in validation_result.errors]
            )

        raw_name = data.get("name") or data.get("project_name")
        if not raw_name:
            if (
                uml_model.id
                and not uml_model.id[0].isdigit()
                and "-" not in uml_model.id
            ):
                raw_name = uml_model.id
            else:
                raw_name = "barberia"
        project_name = raw_name
        import re

        # Sanitizar el nombre para que sea seguro en Docker y Java (sin espacios, minúsculas)
        safe_project_name = re.sub(r"[^a-zA-Z0-9]+", "_", project_name.lower()).strip(
            "_"
        )
        if not safe_project_name:
            safe_project_name = "barberia"

        package_name = f"com.example.{safe_project_name}"

        templates_dir = getattr(
            model_service, "templates_dir", Path("services/generator/templates")
        )
        result = runner.run(
            uml_model=uml_model,
            project_name=safe_project_name,
            package_name=package_name,
            templates_dir=templates_dir,
        )
        return result
    finally:
        GLOBAL_E2E_LOCK.release()
