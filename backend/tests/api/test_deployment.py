from unittest.mock import patch

from app.modules.deployment.service import DEPLOYMENT_LOCK


def test_deploy_locked(client):
    # Probar que si el lock está ocupado devuelve 409
    assert not DEPLOYMENT_LOCK.locked()

    with DEPLOYMENT_LOCK:
        # Aquí el lock está retenido, el request debería fallar con 409
        response = client.post("/api/v1/projects/deploy", json={})

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "DEPLOYMENT_IN_PROGRESS"


@patch(
    "app.modules.deployment.service.check_docker_available", return_value=True
)
@patch(
    "app.modules.deployment.service.check_newman_available", return_value=True
)
def test_deploy_invalid_model(mock_newman, mock_docker, client, valid_uml_json):
    # Enviamos un JSON inválido
    response = client.post("/api/v1/projects/deploy", json={"wrong": "data"})
    # Debería lanzar 422 por invalidación de modelo
    assert response.status_code == 422
