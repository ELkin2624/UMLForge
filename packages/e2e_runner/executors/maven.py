import os
import shutil
from pathlib import Path

from .process import run_command


def find_maven_executable(custom_path: str | None = None) -> str:
    """Resuelve la ruta al ejecutable de Maven de forma portable."""
    if custom_path and Path(custom_path).exists():
        return custom_path

    default_name = "mvn.cmd" if os.name == "nt" else "mvn"
    found = shutil.which(default_name) or shutil.which("mvn")
    if found:
        return found

    # Fallback común en Windows para entornos donde no está en PATH global
    if os.name == "nt":
        candidates = [
            Path(
                "C:/Program Files/JetBrains/IntelliJ IDEA 2026.1/plugins/maven/lib/maven3/bin/mvn.cmd"
            ),
            Path("C:/Program Files/apache-maven/bin/mvn.cmd"),
            Path("C:/apache-maven/bin/mvn.cmd"),
        ]
        for candidate in candidates:
            if candidate.exists():
                return str(candidate)

    return default_name


def maven_verify(
    project_dir: Path, custom_mvn: str | None = None, timeout: int = 180
) -> tuple[bool, str]:
    """Ejecuta mvn clean verify y devuelve éxito y logs."""
    import sys

    mvn_bin = find_maven_executable(custom_mvn)

    cmd = [mvn_bin, "clean", "verify"]
    if sys.platform == "win32":
        cmd = ["cmd.exe", "/c"] + cmd

    res = run_command(cmd, cwd=project_dir, timeout=timeout)
    success = res.returncode == 0
    logs = res.stdout if success else f"{res.stdout}\n{res.stderr}".strip()
    return success, logs


def find_jar(project_dir: Path) -> Path | None:
    """Busca el archivo JAR ejecutable generado en target/."""
    target_dir = project_dir / "target"
    if not target_dir.exists():
        return None

    for file in target_dir.glob("*.jar"):
        if not file.name.endswith(("-javadoc.jar", "-sources.jar", "-plain.jar")):
            return file

    return None
