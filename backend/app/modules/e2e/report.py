import json
from datetime import datetime, timezone
from pathlib import Path

from .models import E2EResult


def save_report(result: E2EResult, output_dir: Path) -> tuple[Path, Path]:
    """
    Guarda el reporte estructurado en formato JSON dentro de output_dir.
    Genera un archivo con timestamp y actualiza latest_report.json.
    Devuelve (timestamp_report_path, latest_report_path).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_filename = f"e2e_report_{result.project_name}_{timestamp}.json"
    report_path = output_dir / report_filename
    latest_path = output_dir / "latest_report.json"

    # Actualizar la ruta relativa en el resultado antes de serializar
    result.report_path = report_filename
    report_data = result.model_dump(mode="json")
    json_str = json.dumps(report_data, indent=2, ensure_ascii=False)

    report_path.write_text(json_str, encoding="utf-8")
    latest_path.write_text(json_str, encoding="utf-8")

    return report_path, latest_path
