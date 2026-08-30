from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from services.api.dependencies import get_model_service
from services.api.main import app
from services.api.services.model_service import ModelService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_model_service():
    mock = MagicMock(spec=ModelService)
    app.dependency_overrides[get_model_service] = lambda: mock
    yield mock
    app.dependency_overrides.clear()


@pytest.fixture
def valid_uml_json():
    return {
        "classes": [
            {
                "id": "c1",
                "name": "User",
                "attributes": [
                    {"id": "a1", "name": "id", "type": "String"},
                    {"id": "a2", "name": "username", "type": "String"},
                ],
                "methods": [],
            }
        ],
        "relationships": [],
    }
