from typing import Any

from app.modules.e2e.config import E2EConfig
from app.modules.e2e.models import StageName, StageStatus
from app.modules.e2e.runner import GLOBAL_E2E_LOCK, E2ERunner

from app.modules.deployment.schemas import DeploymentResult, ServiceStatus, TestSummary
from app.core.errors import InvalidModelError
from app.modules.deployment.utils.docker_utils import check_docker_available
from app.modules.diagrams.service import ModelService
from app.modules.deployment.utils.newman_utils import check_newman_available
from app.core.storage import StorageService

# Mantenemos DEPLOYMENT_LOCK como alias a GLOBAL_E2E_LOCK
DEPLOYMENT_LOCK = GLOBAL_E2E_LOCK


class DeploymentService:
    """
    Servicio de despliegue que delega en el motor central E2ERunner,
    manteniendo la interfaz y el contrato de respuesta DeploymentResult de la Fase 4.
    """

    def __init__(self, model_service: ModelService, storage_service: StorageService):
        self.model_service = model_service
        self.storage_service = storage_service
        self.runner = E2ERunner(
            config=E2EConfig(output_dir=self.storage_service.base_output_dir),
            lock=DEPLOYMENT_LOCK,
        )

    def deploy_and_test(
        self, model_data: dict[str, Any], project_name: str, package_name: str
    ) -> DeploymentResult:
        # Validación temprana de herramientas para tests de Fase 4
        if not check_docker_available():
            raise RuntimeError(
                "Docker / Docker Compose no están disponibles en el host."
            )
        if not check_newman_available():
            raise RuntimeError("Newman no está disponible en el host.")

        # 1. Validación del modelo UML
        uml_model, validation_result = self.model_service.validate_model(model_data)
        if not validation_result.is_valid or uml_model is None:
            raise InvalidModelError(
                errors=[err.model_dump() for err in validation_result.errors]
            )

        # 2. Delegar ejecución en E2ERunner
        e2e_res = self.runner.run(
            uml_model=uml_model,
            project_name=project_name,
            package_name=package_name,
            templates_dir=self.model_service.templates_dir,
        )

        # 3. Mapear E2EResult a DeploymentResult (retrocompatibilidad)
        postgres_status = ServiceStatus(name="postgres", status="down")
        spring_status = ServiceStatus(name="spring_boot", status="down")
        logs_map: dict[str, str] = {}

        for st in e2e_res.stages:
            if st.logs:
                logs_map[st.name.value] = st.logs

            if st.name == StageName.POSTGRES:
                if st.status == StageStatus.SUCCESS:
                    postgres_status.status = "up"
                elif st.status == StageStatus.FAILURE:
                    postgres_status.status = "error"
                    postgres_status.detail = st.error

            elif st.name in (StageName.SPRING, StageName.HEALTH):
                if st.status == StageStatus.SUCCESS:
                    spring_status.status = "up"
                elif st.status == StageStatus.FAILURE:
                    spring_status.status = "error"
                    spring_status.detail = st.error

        test_summary_schema = None
        if e2e_res.test_summary:
            test_summary_schema = TestSummary(
                total=e2e_res.test_summary.total,
                passed=e2e_res.test_summary.passed,
                failed=e2e_res.test_summary.failed,
                skipped=e2e_res.test_summary.skipped,
            )

        return DeploymentResult(
            success=e2e_res.success,
            project_name=e2e_res.project_name,
            duration_ms=e2e_res.total_duration_ms,
            postgres_status=postgres_status,
            spring_boot_status=spring_status,
            test_summary=test_summary_schema,
            error=e2e_res.error,
            logs=logs_map,
        )
