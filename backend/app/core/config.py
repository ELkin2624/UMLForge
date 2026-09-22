from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Raíz del repositorio (fuera de backend/)
REPO_ROOT = Path(__file__).resolve().parents[3]
# Proyectos Spring Boot generados → backend-springboot/ (en la raíz del monorepo)
DEFAULT_OUTPUT_DIR = str(REPO_ROOT / "backend-springboot")


class Settings(BaseSettings):
    OUTPUT_DIR: str = DEFAULT_OUTPUT_DIR
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10 MB
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    
    # Database
    DATABASE_URL: str
    
    # Auth
    JWT_SECRET: str
    JWT_ACCESS_EXPIRES: int = 15
    JWT_REFRESH_EXPIRES: int = 10080
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    
    # AI Providers
    GEMINI_API_KEY: str = ""
    COHERE_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
