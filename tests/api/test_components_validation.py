import json
from pathlib import Path

from fastapi.testclient import TestClient

from services.api.main import app

client = TestClient(app)


def test_validate_architecture_model() -> None:
    """Valida que examples/architecture.json pase la validación HTTP 200 con is_valid: True."""
    arch_file = Path("examples/architecture.json")
    assert arch_file.exists(), "El archivo examples/architecture.json debe existir"

    with open(arch_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    response = client.post("/api/v1/models/validate", json=data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["is_valid"] is True
    assert len(res_json["errors"]) == 0


def test_generate_architecture_model_rejected() -> None:
    """Verifica que POST /api/v1/models/generate rechace el modelo con 422 y GEN_COMPONENT_DIAGRAM_UNSUPPORTED."""
    arch_file = Path("examples/architecture.json")
    with open(arch_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    req_payload = {
        "model_data": data,
        "project_name": "architecture-project",
        "package_name": "com.example.architecture",
    }

    response = client.post("/api/v1/models/generate", json=req_payload)
    assert response.status_code == 422
    err_json = response.json()
    assert err_json["code"] == "GEN_COMPONENT_DIAGRAM_UNSUPPORTED"
    assert "no admite diagramas de componentes" in err_json["message"]
    assert err_json["details"]["components"] == 3
    assert err_json["details"]["interfaces"] == 2
    assert err_json["details"]["connectors"] == 2
