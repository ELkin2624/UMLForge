from tests.api.test_diagrams_versions import _h, client, db_session, world  # noqa: F401

MODEL = {
    "id": "m", "name": "M",
    "classes": [
        {"id": "c1", "name": "Cliente", "operations": [], "attributes": [
            {"id": "a", "name": "id", "type": "Long", "is_primary_key": True}]},
        {"id": "c2", "name": "Venta", "operations": [], "attributes": [
            {"id": "b", "name": "id", "type": "Long", "is_primary_key": True},
            {"id": "c", "name": "clienteNombre", "type": "String"}]},
    ],
    "relationships": [{"id": "r", "source": "c2", "target": "c1", "type": "association",
                       "source_multiplicity": "*", "target_multiplicity": "1"}],
}


def test_analizar_requiere_autenticacion(client):
    assert client.post("/api/v1/data-design/analyze", json={"model_data": MODEL}).status_code == 401


def test_analizar(client, world):
    res = client.post("/api/v1/data-design/analyze", json={"model_data": MODEL}, headers=world["reader"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert {t["name"] for t in body["logical"]["tables"]} == {"clientes", "ventas"}
    assert body["summary"]["pending_suggestions"] == 1


def test_analizar_modelo_invalido(client, world):
    res = client.post("/api/v1/data-design/analyze", json={"model_data": {"classes": "x"}}, headers=world["owner"])
    assert res.status_code == 422


def test_decisiones_se_guardan_y_leen(client, world):
    url = f"/api/v1/diagrams/{world['id']}/data-design/dependencies"
    assert client.get(url, headers=world["reader"]).json() == []
    payload = {"dependencies": [{"table": "ventas", "lhs": ["cliente_id"], "rhs": ["clienteNombre"], "status": "accepted"}]}
    assert client.put(url, json=payload, headers=world["editor"]).status_code == 200
    saved = client.get(url, headers=world["reader"]).json()
    assert saved[0]["status"] == "accepted" and saved[0]["table"] == "ventas"


def test_reader_no_puede_guardar_decisiones(client, world):
    url = f"/api/v1/diagrams/{world['id']}/data-design/dependencies"
    res = client.put(url, json={"dependencies": []}, headers=world["reader"])
    assert res.status_code == 403


def test_estado_invalido_rechazado(client, world):
    url = f"/api/v1/diagrams/{world['id']}/data-design/dependencies"
    bad = {"dependencies": [{"table": "t", "lhs": ["a"], "rhs": ["b"], "status": "hack"}]}
    assert client.put(url, json=bad, headers=world["owner"]).status_code == 422


def test_sin_acceso_no_lee_decisiones(client, world, db_session):
    from tests.api.test_diagrams_versions import _user
    other = _user(db_session, "mallory")
    url = f"/api/v1/diagrams/{world['id']}/data-design/dependencies"
    assert client.get(url, headers=_h(other)).status_code == 403
