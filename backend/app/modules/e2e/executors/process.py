import subprocess
from pathlib import Path
from typing import IO


def _tail(stream: IO[bytes] | None, num_lines: int = 150) -> str:
    """Extrae de forma segura las últimas num_lines de un stream de bytes."""
    if not stream:
        return ""
    lines = stream.read().decode(errors="replace").splitlines()
    return "\n".join(lines[-num_lines:])


def _tail_str(text: str | bytes | None, num_lines: int = 150) -> str:
    """Extrae de forma segura las últimas num_lines de un string o bytes."""
    if text is None:
        return ""
    if isinstance(text, bytes):
        text = text.decode(errors="replace")
    return "\n".join(text.splitlines()[-num_lines:])


def run_command(
    cmd: list[str],
    cwd: Path | None = None,
    timeout: int = 300,
    capture_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    """
    Ejecuta un comando de forma segura (sin shell=True).
    Limita la salida en memoria a las últimas 150 líneas por stream.
    """
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            timeout=timeout,
            capture_output=capture_output,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            shell=False,  # OBLIGATORIO POR SEGURIDAD
        )

        if capture_output:
            if proc.stdout:
                proc.stdout = "\n".join(proc.stdout.splitlines()[-150:])
            if proc.stderr:
                proc.stderr = "\n".join(proc.stderr.splitlines()[-150:])

        return proc
    except subprocess.TimeoutExpired as e:
        if hasattr(e, "stdout"):
            e.stdout = _tail_str(e.stdout)  # type: ignore[assignment]
        if hasattr(e, "stderr"):
            e.stderr = _tail_str(e.stderr)  # type: ignore[assignment]
        raise
