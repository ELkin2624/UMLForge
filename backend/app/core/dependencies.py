from pathlib import Path

from app.core.config import settings
from app.core.storage import StorageService
from app.modules.diagram_store import DiagramRepository, MongoDiagramRepository
from app.modules.diagrams.service import ModelService

# Templates ubicados dentro del módulo generator
TEMPLATES_DIR = Path(__file__).parent.parent / "modules" / "generator" / "templates"


def get_storage_service() -> StorageService:
    return StorageService(base_output_dir=settings.OUTPUT_DIR)


def get_model_service() -> ModelService:
    return ModelService(templates_dir=TEMPLATES_DIR)


_diagram_repo: DiagramRepository | None = None


def get_diagram_repo() -> DiagramRepository:
    """Almacén de diagramas (MongoDB). Singleton; sustituible en tests."""
    global _diagram_repo
    if _diagram_repo is None:
        _diagram_repo = MongoDiagramRepository(
            settings.MONGO_URI, settings.MONGO_DB_NAME
        )
    return _diagram_repo
