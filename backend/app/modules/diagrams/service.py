import tempfile
from pathlib import Path
from typing import Any

from app.core.canonical_model.model import UMLModel
from pydantic import ValidationError
from app.core.validators.generation_rules import GenerationValidator
from app.core.validators.uml_validator import UMLValidator
from app.core.validators.validation_result import ValidationResult

from app.core.errors import GenerationError
from app.modules.diagrams.schemas import APIErrorDetail, ValidationResultResponse
from app.modules.generator.application.generate_project import ProjectGenerator
from app.modules.generator.domain.exceptions import GenerationError as CoreGenerationError
from app.modules.generator.infrastructure.filesystem_exporter import FilesystemExporter
from app.modules.generator.infrastructure.zip_exporter import ZipExporter


class ModelService:
    def __init__(self, templates_dir: Path):
        self.templates_dir = templates_dir

    def validate_model(
        self, data: dict[str, Any]
    ) -> tuple[UMLModel | None, ValidationResultResponse]:
        """
        Intenta parsear y validar el modelo UML.
        Devuelve la instancia de UMLModel (si pudo parsearse) y el ValidationResultResponse.
        """
        response_errors = []
        is_valid = True

        # 1. Parseo Pydantic
        try:
            uml_model = UMLModel.model_validate(data)
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join([str(x) for x in err["loc"]])
                response_errors.append(
                    APIErrorDetail(
                        code="parse_error",
                        message=err["msg"],
                        path=loc,
                        severity="error",
                    )
                )
            return None, ValidationResultResponse(
                is_valid=False, errors=response_errors
            )

        # 2. Validación UML (Estructural + Componentes)
        uml_result = UMLValidator().validate(uml_model)

        for u_err in uml_result.errors:
            response_errors.append(
                APIErrorDetail(
                    code="validation_error", message=str(u_err), severity="error"
                )
            )
            is_valid = False

        for u_warn in uml_result.warnings:
            response_errors.append(
                APIErrorDetail(
                    code="validation_warning", message=str(u_warn), severity="warning"
                )
            )

        return uml_model, ValidationResultResponse(
            is_valid=is_valid, errors=response_errors
        )

    def generate_project(
        self,
        uml_model: UMLModel,
        project_name: str,
        package_name: str,
        output_base: Path,
        local_output_path: str | None = None,
    ) -> tuple[Path, str, list[APIErrorDetail]]:
        """
        Ejecuta el generador de la Fase 2 y devuelve (ruta_al_zip_o_carpeta, checksum, warnings).
        """
        # Reevaluamos warnings (ya sabemos que es válido si llegó aquí)
        gen_result = ValidationResult()
        GenerationValidator().validate(uml_model, gen_result)
        warnings = [
            APIErrorDetail(code="generation_warning", message=w, severity="warning")
            for w in gen_result.warnings
        ]

        generator = ProjectGenerator(templates_dir=self.templates_dir)
        try:
            project = generator.generate(uml_model, project_name, package_name)

            if local_output_path:
                local_dir = Path(local_output_path)
                local_dir.mkdir(parents=True, exist_ok=True)
                FilesystemExporter.export(project, local_dir)
                return local_dir, "N/A", warnings

            # Crear directorio temporal único para esta generación dentro de output_base
            tmp_dir = Path(tempfile.mkdtemp(dir=output_base))

            project_path = FilesystemExporter.export(project, tmp_dir)
            zip_path = tmp_dir / f"{project_name}.zip"
            ZipExporter.export(project_path, zip_path)

            return zip_path, "N/A", warnings

        except CoreGenerationError as e:
            raise GenerationError(str(e))
        except RuntimeError as e:
            raise GenerationError(f"Unexpected error during generation: {e}")
