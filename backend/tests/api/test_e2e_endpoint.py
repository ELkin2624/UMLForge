import uuid
from unittest.mock import patch

from app.core.canonical_model.model import UMLModel
from app.modules.e2e.models import (
    E2EResult,
    StageName,
    StageResult,
    StageStatus,
    TestSummary,
)
from app.modules.e2e.runner import GLOBAL_E2E_LOCK

from app.modules.diagrams.schemas import ValidationResultResponse


def test_validate_e2e_endpoint_success(client, mock_model_service):
    mock_model = UMLModel(
        id=str(uuid.uuid4()),
        name="barberia",
        classes=[],
        relationships=[],
        components=[],
        interfaces=[],
        diagrams=[],
    )
    mock_model_service.validate_model.return_value = (
        mock_model,
        ValidationResultResponse(is_valid=True, errors=[]),
    )

    mock_result = E2EResult(
        success=True,
        project_name="barberia",
        total_duration_ms=1500,
        stages=[
            StageResult(
                name=StageName.VALIDATION, status=StageStatus.SUCCESS, duration_ms=100
            ),
            StageResult(
                name=StageName.GENERATION, status=StageStatus.SUCCESS, duration_ms=200
            ),
        ],
        test_summary=TestSummary(total=18, passed=18, failed=0, skipped=0),
    )

    with patch("app.modules.e2e.runner.E2ERunner.run", return_value=mock_result):
        response = client.post("/api/v1/projects/validate-e2e", json={"classes": []})

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["project_name"] == "barberia"
    assert len(data["stages"]) == 2
    assert data["test_summary"]["passed"] == 18


def test_validate_e2e_endpoint_locked(client):
    # Probar que si el lock global está ocupado devuelve 409
    assert not GLOBAL_E2E_LOCK.locked()

    with GLOBAL_E2E_LOCK:
        response = client.post("/api/v1/projects/validate-e2e", json={})

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "DEPLOYMENT_IN_PROGRESS"


def test_validate_e2e_endpoint_invalid_model(client, mock_model_service):
    mock_model_service.validate_model.return_value = (
        None,
        ValidationResultResponse(is_valid=False, errors=[]),
    )
    response = client.post("/api/v1/projects/validate-e2e", json={"invalido": 123})
    assert response.status_code == 422
