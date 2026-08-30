from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    OUTPUT_DIR: str = "generated/api/"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10 MB
    CORS_ORIGINS: list[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
