from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# Raíz del repositorio (fuera de backend/)
REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = Path(__file__).resolve().parents[2]
# Proyectos Spring Boot generados → backend-springboot/ (en la raíz del monorepo)
DEFAULT_OUTPUT_DIR = str(REPO_ROOT / "backend-springboot")


class Settings(BaseSettings):
    OUTPUT_DIR: str = DEFAULT_OUTPUT_DIR
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10 MB
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    
    # Database (PostgreSQL)
    DATABASE_URL: str
    
    # Database (MongoDB NoSQL)
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "umlforge_ai"
    
    # Auth
    JWT_SECRET: str
    JWT_ACCESS_EXPIRES: int = 15
    JWT_REFRESH_EXPIRES: int = 10080
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    
    # AI Providers
    COLLAB_INTERNAL_URL: str = "http://127.0.0.1:1234"
    COLLAB_SERVICE_TOKEN: str = ""
    AGENT_WORKER_ENABLED: bool = True
    AGENT_MAX_STEPS: int = 8
    AGENT_RUN_TIMEOUT_SECONDS: float = 600.0
    AI_PROVIDER: Literal["gemini", "ollama"] = "gemini"
    GEMINI_API_KEY: str = ""
    # Google retira modelos a menudo: se configuran por entorno, con respaldo en orden.
    GEMINI_MODEL: str = "gemini-3.5-flash"
    GEMINI_FALLBACK_MODELS: list[str] = ["gemini-3.1-flash-lite", "gemini-flash-latest"]
    COHERE_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "qwen3.5:4b"
    OLLAMA_TIMEOUT_SECONDS: float = 180.0
    # Token opcional para un proxy remoto temporal (p. ej. demostración en Kaggle).
    # Ollama local no lo necesita.
    OLLAMA_API_TOKEN: str = ""

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), ".env"), env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
