"""Registro de dispositivos push y disparo de push desde los eventos de compartir."""
from unittest.mock import patch

from app.core.database.models import DeviceToken, Notification

# Fixtures compartidas con las pruebas de invitaciones (BD SQLite en memoria).
from tests.api.test_sharing_invitations import (  # noqa: F401
    auth_headers,
    client,
    db_session,
    test_diagram,
    test_users,
)

PUSH = "app.modules.notifications.service.send_expo_push"


def _tokens(db, user_id):
    return {r.token for r in db.query(DeviceToken).filter(DeviceToken.user_id == user_id)}


# ---------- Registro de dispositivos ----------

def test_registrar_dispositivo_y_reasignarlo_a_otro_usuario(
    client, db_session, test_users, auth_headers  # noqa: F811
):
    body = {"token": "ExponentPushToken[abc]", "platform": "android"}
    res = client.post("/api/v1/notifications/devices", json=body, headers=auth_headers["owner"])
    assert res.status_code == 204
    assert _tokens(db_session, test_users["owner"].id) == {"ExponentPushToken[abc]"}

    # Mismo teléfono, otra cuenta: el token se reasigna (no queda duplicado).
    res = client.post("/api/v1/notifications/devices", json=body, headers=auth_headers["collab"])
    assert res.status_code == 204
    assert _tokens(db_session, test_users["owner"].id) == set()
    assert _tokens(db_session, test_users["collab"].id) == {"ExponentPushToken[abc]"}


def test_desregistrar_solo_borra_el_token_propio(
    client, db_session, test_users, auth_headers  # noqa: F811
):
    body = {"token": "ExponentPushToken[abc]", "platform": "ios"}
    client.post("/api/v1/notifications/devices", json=body, headers=auth_headers["owner"])

    # Otro usuario no puede borrarlo.
    client.post(
        "/api/v1/notifications/devices/unregister",
        json={"token": body["token"]},
        headers=auth_headers["collab"],
    )
    assert _tokens(db_session, test_users["owner"].id) == {"ExponentPushToken[abc]"}

    res = client.post(
        "/api/v1/notifications/devices/unregister",
        json={"token": body["token"]},
        headers=auth_headers["owner"],
    )
    assert res.status_code == 204
    assert _tokens(db_session, test_users["owner"].id) == set()


# ---------- Disparo de push ----------

def _registrar(db, user, token):
    db.add(DeviceToken(user_id=user.id, token=token, platform="android"))
    db.commit()


def test_invitar_envia_push_al_invitado(
    client, db_session, test_diagram, test_users, auth_headers  # noqa: F811
):
    _registrar(db_session, test_users["collab"], "ExponentPushToken[collab]")
    with patch(PUSH) as push:
        res = client.post(
            f"/api/v1/diagrams/{test_diagram.id}/invitations",
            json={"user_id": test_users["collab"].id, "role": "EDITOR"},
            headers=auth_headers["owner"],
        )
    assert res.status_code == 200
    push.assert_called_once()
    tokens, _title, _msg, data = push.call_args.args
    assert tokens == ["ExponentPushToken[collab]"]
    assert data["type"] == "DIAGRAM_INVITATION"


def test_aceptar_y_rechazar_notifican_al_invitador(
    client, db_session, test_diagram, test_users, auth_headers  # noqa: F811
):
    _registrar(db_session, test_users["owner"], "ExponentPushToken[owner]")
    ids = {}
    for who in ("collab", "reader"):
        res = client.post(
            f"/api/v1/diagrams/{test_diagram.id}/invitations",
            json={"user_id": test_users[who].id, "role": "EDITOR"},
            headers=auth_headers["owner"],
        )
        ids[who] = res.json()["invitation_id"]

    with patch(PUSH) as push:
        acc = client.post(f"/api/v1/invitations/{ids['collab']}/accept", headers=auth_headers["collab"])
        rej = client.post(f"/api/v1/invitations/{ids['reader']}/reject", headers=auth_headers["reader"])
    assert acc.status_code == 200
    assert rej.status_code == 200

    types = [c.args[3]["type"] for c in push.call_args_list]
    assert types == ["INVITATION_ACCEPTED", "INVITATION_REJECTED"]
    assert all(c.args[0] == ["ExponentPushToken[owner]"] for c in push.call_args_list)

    stored = {
        n.type
        for n in db_session.query(Notification).filter(
            Notification.recipient_user_id == test_users["owner"].id
        )
    }
    assert stored == {"INVITATION_ACCEPTED", "INVITATION_REJECTED"}


def test_revocar_acceso_envia_push(
    client, db_session, test_diagram, test_users, auth_headers  # noqa: F811
):
    _registrar(db_session, test_users["collab"], "ExponentPushToken[collab]")
    client.post(
        f"/api/v1/diagrams/{test_diagram.id}/invitations",
        json={"user_id": test_users["collab"].id, "role": "EDITOR"},
        headers=auth_headers["owner"],
    )
    with patch(PUSH) as push:
        res = client.delete(
            f"/api/v1/diagrams/{test_diagram.id}/collaborators/{test_users['collab'].id}",
            headers=auth_headers["owner"],
        )
    assert res.status_code == 204
    assert push.call_args.args[3]["type"] == "ACCESS_REVOKED"
    assert push.call_args.args[0] == ["ExponentPushToken[collab]"]
