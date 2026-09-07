from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from app.core.dependencies import get_model_service, get_storage_service
from app.modules.deployment.schemas import DeploymentResult
from app.modules.deployment.service import DEPLOYMENT_LOCK, DeploymentService
from app.modules.diagrams.service import ModelService
from app.core.storage import StorageService

router = APIRouter(prefix="/api/v1/projects", tags=["deployments"])


def get_deployment_service(
    model_service: ModelService = Depends(get_model_service),
    storage_service: StorageService = Depends(get_storage_service),
) -> DeploymentService:
    return DeploymentService(model_service, storage_service)


@router.post("/deploy", response_model=DeploymentResult)
def deploy_project(
    data: dict[str, Any] = Body(...),
    deployment_service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentResult:
    # Bloqueo global: Si está ocupado, devolvemos 409
    if not DEPLOYMENT_LOCK.acquire(blocking=False):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DEPLOYMENT_IN_PROGRESS",
                "message": "Ya existe un despliegue en ejecución.",
            },
        )

    try:
        # Aquí el proyecto y package son fijos o extraer del payload, para demo:
        project_name = "demo"
        package_name = "com.demo"

        result = deployment_service.deploy_and_test(data, project_name, package_name)
        return result
    finally:
        DEPLOYMENT_LOCK.release()
