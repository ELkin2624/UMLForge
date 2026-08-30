#!/usr/bin/env python3
import argparse
import json
import signal
import sys
from pathlib import Path

# Asegurar que el repo root y packages/ estén en sys.path
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
if str(_REPO_ROOT / "packages") not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / "packages"))

from typing import Any

from canonical_model.model import UMLModel
from e2e_runner.config import E2EConfig
from e2e_runner.models import E2EResult, StageStatus
from e2e_runner.runner import E2ERunner


def print_banner(project_name: str) -> None:
    print("=" * 60)
    print(f"  CASE E2E VALIDATION RUNNER - {project_name.upper()}")
    print("=" * 60)


def print_stage_row(
    name: str, status: StageStatus, duration_ms: int, error: str | None = None
) -> None:
    if status == StageStatus.SUCCESS:
        icon = "V [PASS]"
    elif status == StageStatus.FAILURE:
        icon = "X [FAIL]"
    else:
        icon = "- [SKIP]"

    dur_str = f"{duration_ms / 1000.0:.2f}s"
    print(f" {icon:<10} {name:<16} {dur_str:>10}")
    if error and status == StageStatus.FAILURE:
        print(f"   |-- Error: {error}")


def print_summary(result: E2EResult, output_dir: Path) -> None:
    print("-" * 60)
    for stage in result.stages:
        print_stage_row(stage.name.value, stage.status, stage.duration_ms, stage.error)

    print("-" * 60)
    if result.test_summary:
        ts = result.test_summary
        print(
            f" Tests: {ts.total} total, {ts.passed} passed, {ts.failed} failed, {ts.skipped} skipped"
        )

    print(f" Total Duration: {result.total_duration_ms / 1000.0:.2f}s")
    print(f" Report: {output_dir / 'latest_report.json'}")
    print("=" * 60)

    if result.success:
        print(" RESULT: SUCCESS [OK] — Pipeline E2E validado correctamente.")
    else:
        print(" RESULT: FAILURE [X] — El pipeline E2E reportó errores.")
        if result.error:
            print(f" Razón: {result.error}")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CLI para validación automatizada End-to-End de modelos UML en el sistema CASE."
    )
    parser.add_argument(
        "model_path", type=str, help="Ruta al archivo JSON con el modelo UML canónico."
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="reports/e2e",
        help="Directorio para guardar reportes JSON.",
    )
    parser.add_argument(
        "--base-url",
        type=str,
        default="http://localhost:8080",
        help="URL base del servidor Spring Boot.",
    )
    parser.add_argument(
        "--timeout", type=int, default=300, help="Timeout global en segundos."
    )
    parser.add_argument(
        "--timeout-stage", type=int, default=60, help="Timeout por etapa en segundos."
    )
    parser.add_argument(
        "--keep-workspace",
        action="store_true",
        help="[DEBUG] Conservar workspace temporal y contenedores activos tras ejecución.",
    )
    parser.add_argument(
        "--newman-path",
        type=str,
        default=None,
        help="Ruta personalizada al binario de Newman.",
    )
    parser.add_argument(
        "--maven-path",
        type=str,
        default=None,
        help="Ruta personalizada al binario de Maven.",
    )
    parser.add_argument(
        "--project-name",
        type=str,
        default=None,
        help="Nombre del proyecto (por defecto derivado del archivo).",
    )
    parser.add_argument(
        "--package-name",
        type=str,
        default="com.example.barberia",
        help="Paquete base Java.",
    )

    args = parser.parse_args()

    model_file = Path(args.model_path)
    if not model_file.exists():
        print(f"Error: El archivo de modelo '{model_file}' no existe.", file=sys.stderr)
        sys.exit(1)

    project_name = args.project_name or model_file.stem
    print_banner(project_name)

    if args.keep_workspace:
        print(
            "\n [WARNING] --keep-workspace activado. Los contenedores y el directorio temporal "
            "no se eliminarán automáticamente.\n"
        )

    try:
        raw_data = json.loads(model_file.read_text(encoding="utf-8"))
        uml_model = UMLModel.model_validate(raw_data)
    except Exception as e:
        print(
            f"Error al parsear el modelo UML desde '{model_file}': {e}", file=sys.stderr
        )
        sys.exit(1)

    config = E2EConfig(
        output_dir=Path(args.output_dir),
        base_url=args.base_url,
        timeout_global=args.timeout,
        timeout_stage=args.timeout_stage,
        keep_workspace=args.keep_workspace,
        newman_path=args.newman_path,
        maven_path=args.maven_path,
    )

    runner = E2ERunner(config=config)

    # Manejador de señal Ctrl+C para salida limpia
    def handle_sigint(signum: int, frame: Any) -> None:
        print(
            "\n\nInterrupción detectada (Ctrl+C). Limpiando recursos y finalizando...",
            file=sys.stderr,
        )
        sys.exit(130)

    signal.signal(signal.SIGINT, handle_sigint)

    result = runner.run(
        uml_model=uml_model,
        project_name=project_name,
        package_name=args.package_name,
    )

    print_summary(result, Path(args.output_dir))

    sys.exit(0 if result.success else 1)


if __name__ == "__main__":
    main()
