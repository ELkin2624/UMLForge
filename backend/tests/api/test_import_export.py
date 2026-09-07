from pathlib import Path


def test_import_xmi(client) -> None:
    xmi_path = Path("examples/ea_synthetic_class_model.xmi")
    with open(xmi_path, "rb") as f:
        response = client.post(
            "/api/v1/models/import/xmi",
            files={"file": ("model.xmi", f, "application/xml")},
        )
    assert response.status_code == 200
    assert "model" in response.json()


def test_export_xmi(client) -> None:
    barberia_path = Path("examples/barberia.json")
    import json

    model_dict = json.loads(barberia_path.read_text(encoding="utf-8"))
    response = client.post("/api/v1/models/export/xmi", json=model_dict)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
