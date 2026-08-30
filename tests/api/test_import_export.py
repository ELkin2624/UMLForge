def test_import_xmi(client):
    response = client.post("/api/v1/models/import/xmi")
    assert response.status_code == 501
    assert response.json()["detail"] == "XMI import/export not implemented yet"


def test_export_xmi(client):
    response = client.post("/api/v1/models/export/xmi")
    assert response.status_code == 501
    assert response.json()["detail"] == "XMI import/export not implemented yet"
