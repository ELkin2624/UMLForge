import tempfile
from pathlib import Path

from services.api.schemas.response import APIErrorDetail, ValidationResultResponse


def test_generate_success(client, mock_model_service, valid_uml_json):
    import uuid

    from canonical_model.model import UMLModel

    mock_model = UMLModel(
        id=str(uuid.uuid4()),
        name="mock",
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

    # Crear un archivo temporal que represente el ZIP
    temp_dir = tempfile.mkdtemp()
    zip_path = Path(temp_dir) / "demo.zip"
    zip_path.write_bytes(b"dummy zip content")

    mock_model_service.generate_project.return_value = (zip_path, "fake-checksum", [])

    payload = {
        "model_data": valid_uml_json,
        "project_name": "demo",
        "package_name": "com.demo",
    }

    response = client.post("/api/v1/models/generate", json=payload)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.content == b"dummy zip content"


def test_generate_validation_error(client, mock_model_service, valid_uml_json):
    mock_model_service.validate_model.return_value = (
        None,
        ValidationResultResponse(
            is_valid=False,
            errors=[
                APIErrorDetail(code="error", message="bad model", severity="error")
            ],
        ),
    )

    payload = {
        "model_data": valid_uml_json,
        "project_name": "demo",
        "package_name": "com.demo",
    }

    response = client.post("/api/v1/models/generate", json=payload)

    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid UML Model"
