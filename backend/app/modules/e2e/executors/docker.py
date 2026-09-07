import time
from pathlib import Path

import yaml  # type: ignore[import-untyped]

from .process import run_command


def check_docker_available() -> bool:
    """Verifica si docker y docker compose están disponibles."""
    try:
        result = run_command(["docker", "--version"], timeout=10)
        if result.returncode != 0:
            return False
        compose_result = run_command(["docker", "compose", "version"], timeout=10)
        return compose_result.returncode == 0
    except Exception:
        return False


def validate_docker_compose_security(project_dir: Path) -> None:
    """Verifica que el docker-compose.yml no contenga configuraciones inseguras."""
    compose_file = project_dir / "docker-compose.yml"
    if not compose_file.exists():
        raise ValueError("No se encontró docker-compose.yml en el proyecto.")

    try:
        with open(compose_file, encoding="utf-8") as f:
            compose_data = yaml.safe_load(f)
            services = compose_data.get("services", {})
            if "postgres" not in services:
                raise ValueError(
                    "El docker-compose no incluye el servicio esperado 'postgres'."
                )

            pg_volumes = services["postgres"].get("volumes", [])
            for vol in pg_volumes:
                if isinstance(vol, str) and (
                    vol.startswith(("/", "\\")) or (len(vol) > 1 and vol[1] == ":")
                ):
                    raise ValueError(
                        "El docker-compose contiene bind mounts inseguros al host."
                    )
    except yaml.YAMLError as e:
        raise ValueError(f"El docker-compose.yml tiene formato inválido: {e}") from e


def docker_compose_up(project_dir: Path, timeout: int = 60) -> tuple[bool, str]:
    """Ejecuta docker compose up -d en el directorio del proyecto."""
    validate_docker_compose_security(project_dir)
    res = run_command(
        ["docker", "compose", "up", "-d"], cwd=project_dir, timeout=timeout
    )
    success = res.returncode == 0
    logs = res.stdout if success else f"{res.stdout}\n{res.stderr}".strip()
    return success, logs


def docker_compose_down(project_dir: Path, timeout: int = 60) -> tuple[bool, str]:
    """Detiene y elimina los contenedores y volúmenes con docker compose down -v."""
    res = run_command(
        ["docker", "compose", "down", "-v"], cwd=project_dir, timeout=timeout
    )
    success = res.returncode == 0
    logs = res.stdout if success else f"{res.stdout}\n{res.stderr}".strip()
    return success, logs


def wait_for_postgres(project_dir: Path, timeout: int = 60) -> bool:
    """Espera a que el contenedor de PostgreSQL reporte estado 'healthy'."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        res = run_command(
            ["docker", "compose", "ps", "-q", "postgres"], cwd=project_dir, timeout=10
        )
        container_id = res.stdout.strip()
        if container_id:
            inspect_res = run_command(
                [
                    "docker",
                    "inspect",
                    "--format",
                    "{{.State.Health.Status}}",
                    container_id,
                ],
                timeout=10,
            )
            if inspect_res.stdout.strip() == "healthy":
                return True
        time.sleep(2)
    return False
