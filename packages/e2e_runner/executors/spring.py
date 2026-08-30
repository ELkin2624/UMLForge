import subprocess
import time
from pathlib import Path

import httpx

from .process import _tail


def start_spring_boot(
    jar_path: Path,
    cwd: Path,
    stdout_file: Path,
    stderr_file: Path,
) -> subprocess.Popen[str]:
    """Inicia el proceso Spring Boot redirigiendo stdout/stderr a archivos para no bloquear pipes."""
    cmd = ["java", "-jar", str(jar_path)]
    out_f = open(stdout_file, "w", encoding="utf-8")  # noqa: SIM115
    err_f = open(stderr_file, "w", encoding="utf-8")  # noqa: SIM115

    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=out_f,
        stderr=err_f,
        text=True,
        shell=False,  # SEGURIDAD OBLIGATORIA
    )
    return proc


def wait_for_spring_health(
    base_url: str = "http://localhost:8080", timeout: int = 60
) -> bool:
    """Realiza sondeo al Actuator Health hasta que reporte UP."""
    health_url = f"{base_url.rstrip('/')}/actuator/health"
    start_time = time.time()
    with httpx.Client() as client:
        while time.time() - start_time < timeout:
            try:
                res = client.get(health_url, timeout=2.0)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("status") == "UP":
                        return True
            except Exception:
                pass
            time.sleep(2)
    return False


def stop_spring_boot(proc: subprocess.Popen[str] | None, timeout: int = 10) -> None:
    """Detiene el proceso Spring Boot de forma limpia o forzada."""
    if not proc:
        return
    try:
        proc.terminate()
        proc.wait(timeout=timeout)
    except (subprocess.TimeoutExpired, Exception):
        try:
            proc.kill()
        except Exception:
            pass


def get_spring_logs(stdout_file: Path, stderr_file: Path) -> str:
    """Lee y trunca las últimas líneas de los logs generados por Spring Boot."""
    logs = []
    if stdout_file.exists():
        with open(stdout_file, "rb") as out_f:
            tail = _tail(out_f)
            if tail:
                logs.append(tail)
    if stderr_file.exists():
        with open(stderr_file, "rb") as err_f:
            tail = _tail(err_f)
            if tail:
                logs.append(tail)
    return "\n".join(logs)
