"""La presencia de IA es común y el permiso de ejecución es personal."""

from tests.api.test_diagrams_versions import _h, _user, client, db_session, world  # noqa: F401


def url(world):
    return f"/api/v1/diagrams/{world['id']}/agent"


def test_por_defecto_esta_desactivado(client, world):
    assert client.get(url(world), headers=world["owner"]).json() == {
        "enabled": False,
        "permission": "ask",
    }
    detail = client.get(f"/api/v1/diagrams/{world['id']}", headers=world["owner"])
    assert detail.json()["agent_enabled"] is False


def test_todos_los_miembros_pueden_ver_pero_solo_el_propietario_activar(client, world):
    for who in ("editor", "reader"):
        assert client.get(url(world), headers=world[who]).json() == {
            "enabled": False,
            "permission": "ask",
        }
        res = client.put(url(world), json={"enabled": True}, headers=world[who])
        assert res.status_code == 403
    assert client.put(url(world), json={"enabled": True}).status_code == 401
    # nada cambió
    assert client.get(url(world), headers=world["owner"]).json()["enabled"] is False


def test_usuario_ajeno_no_puede_ver_la_politica(client, world, db_session):
    stranger = _user(db_session, "mallory")
    assert client.get(url(world), headers=_h(stranger)).status_code == 403


def test_activar_y_desactivar_se_refleja_para_todos_los_miembros(client, world):
    res = client.put(url(world), json={"enabled": True}, headers=world["owner"])
    assert res.status_code == 200 and res.json() == {
        "enabled": True,
        "permission": "ask",
    }
    detail_url = f"/api/v1/diagrams/{world['id']}"
    for who in ("owner", "editor", "reader"):
        assert client.get(detail_url, headers=world[who]).json()["agent_enabled"] is True
    client.put(url(world), json={"enabled": False}, headers=world["owner"])
    assert client.get(detail_url, headers=world["reader"]).json()["agent_enabled"] is False


def test_diagrama_inexistente_da_404(client, world):
    res = client.put("/api/v1/diagrams/999999/agent", json={"enabled": True}, headers=world["owner"])
    assert res.status_code == 404


def test_cada_miembro_configura_su_permiso_sin_afectar_a_los_demas(client, world):
    for who, permission in (("owner", "full"), ("editor", "safe"), ("reader", "full")):
        res = client.put(url(world), json={"permission": permission}, headers=world[who])
        assert res.status_code == 200
        assert res.json() == {"enabled": False, "permission": permission}

    for who, permission in (("owner", "full"), ("editor", "safe"), ("reader", "full")):
        assert client.get(url(world), headers=world[who]).json()["permission"] == permission

    res = client.put(url(world), json={"enabled": True}, headers=world["owner"])
    assert res.status_code == 200
    assert res.json() == {"enabled": True, "permission": "full"}
    assert client.get(url(world), headers=world["editor"]).json() == {
        "enabled": True, "permission": "safe"
    }

    invalid = client.put(
        url(world), json={"permission": "unrestricted"}, headers=world["owner"]
    )
    assert invalid.status_code == 422

    combined = client.put(
        url(world), json={"enabled": False, "permission": "ask"}, headers=world["editor"]
    )
    assert combined.status_code == 403
    assert client.get(url(world), headers=world["editor"]).json()["permission"] == "safe"
