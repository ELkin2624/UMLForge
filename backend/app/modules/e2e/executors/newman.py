import json
import shutil
import sys
from pathlib import Path

from .process import run_command


def find_newman_command(custom_path: str | None = None) -> list[str]:
    """Resuelve la invocación de Newman (binario directo o via npx)."""
    if custom_path and Path(custom_path).exists():
        base_cmd = [custom_path]
    elif shutil.which("newman"):
        base_cmd = [shutil.which("newman") or "newman"]
    elif shutil.which("newman.cmd"):
        base_cmd = [shutil.which("newman.cmd") or "newman.cmd"]
    elif shutil.which("npx"):
        base_cmd = [shutil.which("npx") or "npx", "-y", "newman"]
    else:
        base_cmd = ["newman"]

    if sys.platform == "win32":
        return ["cmd.exe", "/c"] + base_cmd
    return base_cmd


def check_newman_available(custom_path: str | None = None) -> bool:
    """Verifica si Newman está disponible para ejecución."""
    # Verificación rápida por sistema de archivos / PATH sin esperar arranque de Node
    if custom_path and Path(custom_path).exists():
        return True
    if shutil.which("newman") or shutil.which("newman.cmd") or shutil.which("npx"):
        return True
    try:
        cmd = find_newman_command(custom_path) + ["--version"]
        res = run_command(cmd, timeout=30)
        return res.returncode == 0
    except Exception:
        return False



def run_newman(
    collection_path: Path,
    report_dir: Path,
    environment_path: Path | None = None,
    custom_newman: str | None = None,
    timeout: int = 60,
) -> tuple[bool, dict[str, int], str]:
    """
    Ejecuta Newman de forma aislada, reporta en JSON a report_dir y parsea el resumen de tests.
    Devuelve (success, TestSummary_dict, logs).
    """
    report_file = report_dir / "newman-report.json"
    cmd = find_newman_command(custom_newman) + [
        "run",
        str(collection_path),
        "--reporters",
        "cli,json",
        "--reporter-json-export",
        str(report_file),
    ]

    if environment_path and environment_path.exists():
        cmd.extend(["-e", str(environment_path)])

    res = run_command(cmd, timeout=timeout)
    success = res.returncode == 0
    logs = res.stdout if success else f"{res.stdout}\n{res.stderr}".strip()

    summary = {"total": 0, "passed": 0, "failed": 0, "skipped": 0}

    if report_file.exists():
        try:
            report_data = json.loads(report_file.read_text(encoding="utf-8"))
            stats = report_data.get("run", {}).get("stats", {})
            assertions = stats.get("assertions", {})

            summary["total"] = assertions.get("total", 0)
            summary["failed"] = assertions.get("failed", 0)
            summary["passed"] = summary["total"] - summary["failed"]
            summary["skipped"] = assertions.get("pending", 0)
        except Exception:
            pass  # Fallback a 0s

    return success, summary, logs
