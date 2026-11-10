from unittest.mock import MagicMock, patch

from app.modules.notifications import push


def test_send_expo_push_sin_tokens_no_llama_a_la_red():
    with patch.object(push.httpx, "Client") as client:
        push.send_expo_push([], "t", "b")
    client.assert_not_called()


def test_send_expo_push_envia_un_mensaje_por_token():
    response = MagicMock(status_code=200)
    response.json.return_value = {"data": [{"status": "ok"}, {"status": "ok"}]}
    http = MagicMock()
    http.post.return_value = response
    with patch.object(push.httpx, "Client") as client:
        client.return_value.__enter__.return_value = http
        push.send_expo_push(["ExponentPushToken[a]", "ExponentPushToken[b]"], "Hola", "Mundo", {"x": 1})

    (url,), kwargs = http.post.call_args
    assert url == push.EXPO_PUSH_URL
    assert [m["to"] for m in kwargs["json"]] == ["ExponentPushToken[a]", "ExponentPushToken[b]"]
    assert kwargs["json"][0]["title"] == "Hola"
    assert kwargs["json"][0]["data"] == {"x": 1}


def _client_con_respuestas(*bodies):
    http = MagicMock()
    http.post.side_effect = [
        MagicMock(status_code=200, **{"json.return_value": {"data": b}}) for b in bodies
    ]
    return http


def test_send_expo_push_divide_en_lotes_de_100():
    tokens = [f"ExponentPushToken[{i}]" for i in range(150)]
    http = _client_con_respuestas(
        [{"status": "ok"}] * 100, [{"status": "ok"}] * 50
    )
    with patch.object(push.httpx, "Client") as client:
        client.return_value.__enter__.return_value = http
        push.send_expo_push(tokens, "t", "b")

    assert http.post.call_count == 2
    assert len(http.post.call_args_list[0].kwargs["json"]) == 100
    assert len(http.post.call_args_list[1].kwargs["json"]) == 50


def test_send_expo_push_borra_tokens_device_not_registered():
    http = _client_con_respuestas(
        [
            {"status": "ok"},
            {"status": "error", "details": {"error": "DeviceNotRegistered"}},
            {"status": "error", "details": {"error": "MessageRateExceeded"}},
        ]
    )
    with patch.object(push.httpx, "Client") as client, patch.object(
        push, "remove_tokens"
    ) as remove:
        client.return_value.__enter__.return_value = http
        push.send_expo_push(["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"], "t", "b")

    remove.assert_called_once_with(["ExponentPushToken[b]"])


def test_remove_tokens_no_lanza_si_falla_la_base():
    with patch.object(push, "SessionLocal", side_effect=RuntimeError("sin db")):
        push.remove_tokens(["ExponentPushToken[a]"])


def test_send_expo_push_traga_errores_de_red():
    with patch.object(push.httpx, "Client", side_effect=RuntimeError("sin red")):
        push.send_expo_push(["ExponentPushToken[a]"], "t", "b")
