"""Enlace de acceso general con token en el backend."""

from app.core.database.models import DiagramPermission, DiagramShareLink
from tests.api.test_diagrams_versions import _h, _user, client, db_session, world  # noqa: F401


def url(world):
    return f"/api/v1/diagrams/{world['id']}/share-link"


def enable(client, world, role="EDITOR"):
    res = client.put(url(world), json={"enabled": True, "role": role}, headers=world["owner"])
    assert res.status_code == 200, res.text
    return res.json()


def test_por_defecto_esta_desactivado_y_sin_token(client, world):
    res = client.get(url(world), headers=world["owner"])
    assert res.status_code == 200
    assert res.json()["enabled"] is False and res.json()["token"] is None


def test_solo_el_propietario_ve_o_cambia_el_enlace(client, world):
    for who in ("editor", "reader"):
        assert client.get(url(world), headers=world[who]).status_code == 403
        assert client.put(url(world), json={"enabled": True, "role": "EDITOR"}, headers=world[who]).status_code == 403
        assert client.post(url(world) + "/regenerate", headers=world[who]).status_code == 403
    assert client.get(url(world)).status_code == 401


def test_activar_crea_token_y_se_conserva(client, world):
    first = enable(client, world, "READER")
    assert first["enabled"] and first["role"] == "READER" and len(first["token"]) >= 32
    again = enable(client, world, "EDITOR")
    assert again["token"] == first["token"] and again["role"] == "EDITOR"
    assert client.get(url(world), headers=world["owner"]).json()["token"] == first["token"]


def test_un_desconocido_se_une_con_el_rol_del_enlace(client, world, db_session):
    token = enable(client, world, "READER")["token"]
    stranger = _user(db_session, "mallory")
    res = client.post(f"/api/v1/share-links/{token}/join", headers=_h(stranger))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["diagram_id"] == world["id"] and body["role"] == "READER" and body["already_member"] is False
    perm = db_session.query(DiagramPermission).filter_by(diagram_id=world["id"], user_id=stranger.id).one()
    assert perm.role == "READER"
    # ya puede abrir el diagrama (esto es lo que valida el servidor Yjs)
    assert client.get(f"/api/v1/diagrams/{world['id']}", headers=_h(stranger)).status_code == 200


def test_unirse_con_enlace_editor_permite_editar(client, world, db_session):
    token = enable(client, world, "EDITOR")["token"]
    stranger = _user(db_session, "mallory")
    assert client.post(f"/api/v1/share-links/{token}/join", headers=_h(stranger)).json()["role"] == "EDITOR"
    res = client.put(f"/api/v1/diagrams/{world['id']}", json={"data": {"classes": []}, "expected_revision": 1}, headers=_h(stranger))
    assert res.status_code == 200


def test_enlace_desactivado_o_inexistente_da_404(client, world, db_session):
    token = enable(client, world)["token"]
    client.put(url(world), json={"enabled": False, "role": "EDITOR"}, headers=world["owner"])
    stranger = _user(db_session, "mallory")
    assert client.post(f"/api/v1/share-links/{token}/join", headers=_h(stranger)).status_code == 404
    assert client.post("/api/v1/share-links/inventado/join", headers=_h(stranger)).status_code == 404
    assert db_session.query(DiagramPermission).filter_by(user_id=stranger.id).count() == 0


def test_unirse_requiere_sesion(client, world):
    token = enable(client, world)["token"]
    assert client.post(f"/api/v1/share-links/{token}/join").status_code == 401


def test_no_rebaja_un_rol_existente(client, world):
    token = enable(client, world, "READER")["token"]
    # el propietario y el editor ya son miembros: conservan su rol
    owner = client.post(f"/api/v1/share-links/{token}/join", headers=world["owner"]).json()
    editor = client.post(f"/api/v1/share-links/{token}/join", headers=world["editor"]).json()
    assert owner["role"] == "OWNER" and owner["already_member"] is True
    assert editor["role"] == "EDITOR" and editor["already_member"] is True


def test_unirse_dos_veces_es_idempotente(client, world, db_session):
    token = enable(client, world)["token"]
    stranger = _user(db_session, "mallory")
    first = client.post(f"/api/v1/share-links/{token}/join", headers=_h(stranger)).json()
    second = client.post(f"/api/v1/share-links/{token}/join", headers=_h(stranger)).json()
    assert first["already_member"] is False and second["already_member"] is True
    assert db_session.query(DiagramPermission).filter_by(diagram_id=world["id"], user_id=stranger.id).count() == 1


def test_regenerar_invalida_el_enlace_anterior(client, world, db_session):
    old = enable(client, world)["token"]
    new = client.post(url(world) + "/regenerate", headers=world["owner"]).json()
    assert new["token"] != old and new["enabled"] is True
    stranger = _user(db_session, "mallory")
    assert client.post(f"/api/v1/share-links/{old}/join", headers=_h(stranger)).status_code == 404
    assert client.post(f"/api/v1/share-links/{new['token']}/join", headers=_h(stranger)).status_code == 200


def test_regenerar_sin_enlace_da_404(client, world):
    assert client.post(url(world) + "/regenerate", headers=world["owner"]).status_code == 404


def test_rol_invalido_rechazado(client, world):
    res = client.put(url(world), json={"enabled": True, "role": "OWNER"}, headers=world["owner"])
    assert res.status_code == 422


def test_borrar_el_diagrama_elimina_el_enlace(client, world, db_session):
    enable(client, world)
    assert db_session.query(DiagramShareLink).count() == 1
    assert client.delete(f"/api/v1/diagrams/{world['id']}", headers=world["owner"]).status_code == 204
    assert db_session.query(DiagramShareLink).count() == 0
