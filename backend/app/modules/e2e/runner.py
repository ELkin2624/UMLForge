from __future__ import annotations

import shutil
import tempfile
import threading
import time
import zipfile
from pathlib import Path

from app.core.canonical_model.model import UMLModel
from app.core.validators.generation_rules import GenerationValidator
from app.core.validators.structural_validator import StructuralValidator
from app.core.validators.validation_result import ValidationResult

from app.modules.generator.application.generate_project import ProjectGenerator
from app.modules.generator.infrastructure.filesystem_exporter import FilesystemExporter
from app.modules.generator.infrastructure.zip_exporter import ZipExporter

from .config import E2EConfig
from .executors import (
    check_docker_available,
    check_newman_available,
    docker_compose_down,
    docker_compose_up,
    find_jar,
    get_spring_logs,
    maven_verify,
    run_newman,
    start_spring_boot,
    stop_spring_boot,
    wait_for_postgres,
    wait_for_spring_health,
)
from .models import E2EResult, StageName, StageResult, StageStatus, TestSummary
from .report import save_report

# Lock global para evitar colisiones en puertos (8080, 5432)
GLOBAL_E2E_LOCK = threading.Lock()

DEFAULT_TEMPLATES_DIR = Path(__file__).parent.parent / "generator" / "templates"


class E2ERunner:
    """
    Orquestador síncrono y determinista para la validación End-to-End.
    Ejecuta el ciclo:
    Modelo UML -> Validación -> Generación -> Docker (Postgres) -> Maven -> Spring Boot -> Newman -> Reporte -> Cleanup.
    """

    def __init__(
        self, config: E2EConfig | None = None, lock: threading.Lock | None = None
    ):
        self.config = config or E2EConfig()
        self.lock = lock or GLOBAL_E2E_LOCK

    def run(
        self,
        uml_model: UMLModel,
        project_name: str = "barberia",
        package_name: str = "com.example.barberia",
        templates_dir: Path | str | None = None,
    ) -> E2EResult:
        if templates_dir is None or str(templates_dir) == "services/generator/templates":
            templates_dir = DEFAULT_TEMPLATES_DIR
        templates_dir = Path(templates_dir)

        start_time = time.time()
        stages: list[StageResult] = []
        test_summary: TestSummary | None = None
        global_error: str | None = None
        overall_success = False

        temp_workspace = Path(tempfile.mkdtemp(prefix=f"e2e_{project_name}_"))
        project_dir = temp_workspace / project_name
        zip_output_dir = temp_workspace / "dist"
        zip_output_dir.mkdir(parents=True, exist_ok=True)
        zip_path = zip_output_dir / f"{project_name}.zip"

        spring_proc = None
        spring_out_file = temp_workspace / "spring.out"
        spring_err_file = temp_workspace / "spring.err"

        try:
            # 1. Validación de herramientas previas
            if not check_docker_available():
                raise RuntimeError(
                    "Docker o Docker Compose no están disponibles en el host."
                )
            if not check_newman_available(self.config.newman_path):
                raise RuntimeError("Newman no está disponible en el host.")

            # ----------------------------------------------------
            # ETAPA 1: VALIDATION
            # ----------------------------------------------------
            s_start = time.time()
            validation_errors: list[str] = []

            struct_result = ValidationResult()
            StructuralValidator().validate(uml_model, struct_result)
            validation_errors.extend(struct_result.errors)

            gen_result = ValidationResult()
            GenerationValidator().validate(uml_model, gen_result)
            validation_errors.extend(gen_result.errors)

            s_dur = int((time.time() - s_start) * 1000)
            if validation_errors:
                err_msg = "; ".join(validation_errors)
                stages.append(
                    StageResult(
                        name=StageName.VALIDATION,
                        status=StageStatus.FAILURE,
                        duration_ms=s_dur,
                        error=err_msg,
                    )
                )
                raise ValueError(f"Fallo en validación UML: {err_msg}")

            stages.append(
                StageResult(
                    name=StageName.VALIDATION,
                    status=StageStatus.SUCCESS,
                    duration_ms=s_dur,
                )
            )

            # ----------------------------------------------------
            # ETAPA 2: GENERATION
            # ----------------------------------------------------
            s_start = time.time()
            generator = ProjectGenerator(templates_dir=templates_dir)
            generated_proj = generator.generate(uml_model, project_name, package_name)

            export_dir = temp_workspace / "raw"
            project_path = FilesystemExporter.export(generated_proj, export_dir)
            ZipExporter.export(project_path, zip_path)
            s_dur = int((time.time() - s_start) * 1000)

            stages.append(
                StageResult(
                    name=StageName.GENERATION,
                    status=StageStatus.SUCCESS,
                    duration_ms=s_dur,
                    logs=f"Generados {len(generated_proj.files)} archivos.",
                )
            )

            # ----------------------------------------------------
            # ETAPA 3: EXTRACTION & STRUCTURE
            # ----------------------------------------------------
            s_start = time.time()
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(temp_workspace)

            self._validate_project_structure(project_dir)
            s_dur = int((time.time() - s_start) * 1000)

            stages.append(
                StageResult(
                    name=StageName.EXTRACTION,
                    status=StageStatus.SUCCESS,
                    duration_ms=s_dur,
                )
            )

            # ----------------------------------------------------
            # ETAPA 4: POSTGRES (DOCKER)
            # ----------------------------------------------------
            s_start = time.time()
            docker_up_ok, docker_up_logs = docker_compose_up(
                project_dir, timeout=self.config.timeout_stage
            )
            if not docker_up_ok:
                s_dur = int((time.time() - s_start) * 1000)
                stages.append(
                    StageResult(
                        name=StageName.POSTGRES,
                        status=StageStatus.FAILURE,
                        duration_ms=s_dur,
                        error="Fallo al ejecutar docker compose up",
                        logs=docker_up_logs,
                    )
                )
                raise RuntimeError("Falló al iniciar PostgreSQL vía Docker Compose.")

            pg_healthy = wait_for_postgres(
                project_dir, timeout=self.config.timeout_stage
            )
            s_dur = int((time.time() - s_start) * 1000)
            if not pg_healthy:
                stages.append(
                    StageResult(
                        name=StageName.POSTGRES,
                        status=StageStatus.FAILURE,
                        duration_ms=s_dur,
                        error="Timeout esperando estado healthy de PostgreSQL",
                        logs=docker_up_logs,
                    )
                )
                raise RuntimeError("PostgreSQL no reportó estado 'healthy' a tiempo.")

            stages.append(
                StageResult(
                    name=StageName.POSTGRES,
                    status=StageStatus.SUCCESS,
                    duration_ms=s_dur,
                    logs=docker_up_logs,
                )
            )

            # ----------------------------------------------------
            # ETAPA 5: MAVEN (VERIFY & JAR)
            # ----------------------------------------------------
            s_start = time.time()
            mvn_ok, mvn_logs = maven_verify(
                project_dir,
                custom_mvn=self.config.maven_path,
                timeout=self.config.timeout_global,
            )
            s_dur = int((time.time() - s_start) * 1000)

            if not mvn_ok:
                stages.append(
                    StageResult(
                        name=StageName.MAVEN,
                        status=StageStatus.FAILURE,
                        duration_ms=s_dur,
                        error="Fallo en maven verify",
                        logs=mvn_logs,
                    )
                )
                raise RuntimeError(
                    "Fallo durante la compilación/verificación de Maven."
                )

            jar_file = find_jar(project_dir)
            if not jar_file:
                stages.append(
                    StageResult(
                        name=StageName.MAVEN,
                        status=StageStatus.FAILURE,
                        duration_ms=s_dur,
                        error="JAR ejecutable no encontrado en target/",
                        logs=mvn_logs,
                    )
                )
                raise RuntimeError(
                    "No se encontró el JAR generado tras la compilación."
                )

            stages.append(
                StageResult(
                    name=StageName.MAVEN,
                    status=StageStatus.SUCCESS,
                    duration_ms=s_dur,
                    logs=mvn_logs,
                )
            )

            # ----------------------------------------------------
            # ETAPA 6: SPRING BOOT START
            # ----------------------------------------------------
            s_start = time.time()
            spring_proc = start_spring_boot(
                jar_file, project_dir, spring_out_file, spring_err_file
            )
            s_dur = int((time.time() - s_start) * 1000)

            stages.append(
                StageResult(
                    name=StageName.SPRING,
                    status=StageStatus.SUCCESS,
                    duration_ms=s_dur,
                )
            )

            # ----------------------------------------------------
            # ETAPA 7: SPRING BOOT HEALTH
            # ----------------------------------------------------
            s_start = time.time()
            health_ok = wait_for_spring_health(
                self.config.base_url, timeout=self.config.timeout_stage
            )
            s_dur = int((time.time() - s_start) * 1000)

            if not health_ok:
                spring_logs = get_spring_logs(spring_out_file, spring_err_file)
                stages.append(
                    StageResult(
                        name=StageName.HEALTH,
                        status=StageStatus.FAILURE,
                        duration_ms=s_dur,
                        error="Timeout esperando Actuator UP en Spring Boot",
                        logs=spring_logs,
                    )
                )
                raise RuntimeError(
                    "Spring Boot no reportó estado UP en /actuator/health."
                )

            stages.append(
                StageResult(
                    name=StageName.HEALTH,
                    status=StageStatus.SUCCESS,
                    duration_ms=s_dur,
                )
            )

            # ----------------------------------------------------
            # ETAPA 8: NEWMAN POSTMAN TESTS
            # ----------------------------------------------------
            s_start = time.time()
            postman_dir = project_dir / "postman"
            collection = next(
                postman_dir.glob("*.postman_collection.json"), None
            ) or next(postman_dir.glob("*.json"), None)
            environment = next(postman_dir.glob("*.postman_environment.json"), None)

            if not collection:
                s_dur = int((time.time() - s_start) * 1000)
                stages.append(
                    StageResult(
                        name=StageName.NEWMAN,
                        status=StageStatus.FAILURE,
                        duration_ms=s_dur,
                        error="Colección Postman no encontrada en el proyecto.",
                    )
                )
                raise RuntimeError("No se encontró archivo de colección Postman.")

            newman_ok, newman_stats, newman_logs = run_newman(
                collection_path=collection,
                environment_path=environment,
                report_dir=temp_workspace,
                custom_newman=self.config.newman_path,
                timeout=self.config.timeout_stage,
            )
            s_dur = int((time.time() - s_start) * 1000)
            test_summary = TestSummary(**newman_stats)

            if not newman_ok or test_summary.failed > 0:
                stages.append(
                    StageResult(
                        name=StageName.NEWMAN,
                        status=StageStatus.FAILURE,
                        duration_ms=s_dur,
                        error=f"Newman reportó {test_summary.failed} fallos en aserciones.",
                        logs=newman_logs,
                    )
                )
                raise RuntimeError(
                    "Fallaron las pruebas de integración Postman con Newman."
                )

            stages.append(
                StageResult(
                    name=StageName.NEWMAN,
                    status=StageStatus.SUCCESS,
                    duration_ms=s_dur,
                    logs=newman_logs,
                )
            )

            overall_success = True

        except Exception as e:
            global_error = str(e)
            overall_success = False

        finally:
            # ----------------------------------------------------
            # CLEANUP SIEMPRE GARANTIZADO
            # ----------------------------------------------------
            # 1. Detener Spring Boot
            if spring_proc:
                stop_spring_boot(spring_proc)

            # 2. Detener Docker PostgreSQL
            if project_dir.exists() and (project_dir / "docker-compose.yml").exists():
                docker_compose_down(project_dir)

            # 3. Eliminar directorio temporal si no se pidió mantenerlo
            if not self.config.keep_workspace and temp_workspace.exists():
                try:
                    shutil.rmtree(temp_workspace, ignore_errors=True)
                except Exception:
                    pass

        total_dur = int((time.time() - start_time) * 1000)

        # Determinar etapas omitidas para consistencia del reporte
        all_stage_names = [
            StageName.VALIDATION,
            StageName.GENERATION,
            StageName.EXTRACTION,
            StageName.POSTGRES,
            StageName.MAVEN,
            StageName.SPRING,
            StageName.HEALTH,
            StageName.NEWMAN,
        ]
        executed_names = {s.name for s in stages}
        for st_name in all_stage_names:
            if st_name not in executed_names:
                stages.append(
                    StageResult(name=st_name, status=StageStatus.SKIPPED, duration_ms=0)
                )

        # Ordenar etapas según la secuencia oficial
        stages.sort(key=lambda s: all_stage_names.index(s.name))

        result = E2EResult(
            success=overall_success,
            project_name=project_name,
            total_duration_ms=total_dur,
            stages=stages,
            test_summary=test_summary,
            zip_path=f"{project_name}.zip" if overall_success else None,
            error=global_error,
        )

        # Guardar reporte JSON
        try:
            save_report(result, self.config.output_dir)
        except Exception:
            pass

        return result

    def _validate_project_structure(self, project_dir: Path) -> None:
        """Verifica la integridad de la estructura generada."""
        if not (project_dir / "pom.xml").exists():
            raise ValueError("Falta pom.xml en el proyecto generado.")
        if not (project_dir / "docker-compose.yml").exists():
            raise ValueError("Falta docker-compose.yml en el proyecto generado.")
        if not (project_dir / "src").is_dir():
            raise ValueError("Falta directorio src/ en el proyecto generado.")
        if not (project_dir / "postman").is_dir():
            raise ValueError("Falta directorio postman/ en el proyecto generado.")
