import io
from pathlib import Path

from fastapi.testclient import TestClient

from services.api.main import app

client = TestClient(app)


def test_api_import_xmi_success() -> None:
    xmi_path = Path("examples/ea_synthetic_class_model.xmi")
    assert xmi_path.exists()

    with open(xmi_path, "rb") as f:
        response = client.post(
            "/api/v1/models/import/xmi",
            files={"file": ("model.xmi", f, "application/xml")},
        )

    assert response.status_code == 200
    data = response.json()
    assert "model" in data
    assert "warnings" in data
    assert len(data["model"]["classes"]) == 2


def test_api_import_xmi_invalid_xml() -> None:
    fake_file = io.BytesIO(b"<invalid><xml")
    response = client.post(
        "/api/v1/models/import/xmi",
        files={"file": ("bad.xmi", fake_file, "application/xml")},
    )
    assert response.status_code == 400
    assert "XMI_INVALID_XML" in str(response.json())


def test_api_export_xmi_success() -> None:
    barberia_path = Path("examples/barberia.json")
    assert barberia_path.exists()
    model_json = barberia_path.read_text(encoding="utf-8")

    import json

    model_dict = json.loads(model_json)

    response = client.post("/api/v1/models/export/xmi", json=model_dict)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert "attachment; filename=" in response.headers.get("content-disposition", "")
    assert b"<xmi:XMI" in response.content
    assert b"<uml:Model" in response.content


def test_api_xmi_to_downstream_generation() -> None:
    # 1. Importar XMI a CanonicalModel
    xmi_path = Path("examples/ea_synthetic_class_model.xmi")
    with open(xmi_path, "rb") as f:
        import_resp = client.post(
            "/api/v1/models/import/xmi",
            files={"file": ("model.xmi", f, "application/xml")},
        )
    assert import_resp.status_code == 200
    imported_model = import_resp.json()["model"]

    # 2. Validar con el endpoint estándar /validate
    val_resp = client.post("/api/v1/models/validate", json=imported_model)
    assert val_resp.status_code == 200
    assert val_resp.json()["is_valid"] is True

    # 3. Generar proyecto Spring Boot con /generate usando GenerateRequest
    gen_payload = {
        "model_data": imported_model,
        "project_name": "BarberiaProject",
        "package_name": "com.example.barberia",
    }
    gen_resp = client.post("/api/v1/models/generate", json=gen_payload)
    assert gen_resp.status_code == 200
    assert gen_resp.headers["content-type"] == "application/zip"
    assert len(gen_resp.content) > 1000
