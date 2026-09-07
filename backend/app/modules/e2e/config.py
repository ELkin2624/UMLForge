from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[4]


class E2EConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="E2E_", extra="ignore")

    output_dir: Path = REPO_ROOT / "reports" / "e2e"
    base_url: str = "http://localhost:8080"
    timeout_global: int = 300
    timeout_stage: int = 60
    cleanup_on_failure: bool = True
    keep_workspace: bool = False
    newman_path: str | None = None
    maven_path: str | None = None
