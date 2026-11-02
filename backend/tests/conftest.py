"""Fixtures globales: los diagramas viven en MongoDB, que no se usa en tests."""

import pytest

from app.core.dependencies import get_diagram_repo
from app.main import app
from app.modules.diagram_store import InMemoryDiagramRepository


@pytest.fixture(autouse=True)
def diagram_repo():
    """Sustituye el almacén Mongo por uno en memoria en todos los tests."""
    repo = InMemoryDiagramRepository()
    app.dependency_overrides[get_diagram_repo] = lambda: repo
    yield repo
    app.dependency_overrides.pop(get_diagram_repo, None)
