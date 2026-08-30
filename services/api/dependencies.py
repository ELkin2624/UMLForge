from pathlib import Path

from services.api.config import settings
from services.api.services.model_service import ModelService
from services.api.services.storage import StorageService

# Asumimos que los templates están en la ruta de Fase 2 relativa al monorepo
TEMPLATES_DIR = Path(__file__).parent.parent / "generator" / "templates"


def get_storage_service() -> StorageService:
    return StorageService(base_output_dir=settings.OUTPUT_DIR)


def get_model_service() -> ModelService:
    return ModelService(templates_dir=TEMPLATES_DIR)
