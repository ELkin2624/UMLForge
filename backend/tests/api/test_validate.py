from app.modules.diagrams.schemas import APIErrorDetail, ValidationResultResponse


def test_validate_valid_model(client, mock_model_service, valid_uml_json):
    mock_model_service.validate_model.return_value = (
        None,
        ValidationResultResponse(is_valid=True, errors=[]),
    )

    response = client.post("/api/v1/models/validate", json=valid_uml_json)

    assert response.status_code == 200
    assert response.json()["is_valid"] is True
    assert len(response.json()["errors"]) == 0


def test_validate_invalid_model_format(client, mock_model_service):
    # Sin model data válido
    mock_model_service.validate_model.return_value = (
        None,
        ValidationResultResponse(
            is_valid=False,
            errors=[
                APIErrorDetail(
                    code="parse_error", message="Missing field", severity="error"
                )
            ],
        ),
    )

    response = client.post("/api/v1/models/validate", json={"wrong": "data"})

    assert response.status_code == 200
    assert response.json()["is_valid"] is False
    assert len(response.json()["errors"]) == 1
    assert response.json()["errors"][0]["code"] == "parse_error"
