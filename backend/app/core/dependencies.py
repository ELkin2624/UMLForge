from pathlib import Path

from app.core.config import settings
from app.core.storage import StorageService
from app.modules.diagrams.service import ModelService

# Templates ubicados dentro del módulo generator
TEMPLATES_DIR = Path(__file__).parent.parent / "modules" / "generator" / "templates"


def get_storage_service() -> StorageService:
    return StorageService(base_output_dir=settings.OUTPUT_DIR)


def get_model_service() -> ModelService:
    return ModelService(templates_dir=TEMPLATES_DIR)
