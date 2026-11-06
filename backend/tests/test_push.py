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


def test_send_expo_push_traga_errores_de_red():
    with patch.object(push.httpx, "Client", side_effect=RuntimeError("sin red")):
        push.send_expo_push(["ExponentPushToken[a]"], "t", "b")
