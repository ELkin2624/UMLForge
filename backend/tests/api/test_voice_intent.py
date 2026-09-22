import pytest
from unittest.mock import patch, MagicMock

def test_parse_intent_gemini_success(client):
    mock_response = MagicMock()
    mock_response.text = '{"commands": [{"type": "CREATE_CLASS", "className": "Rol"}]}'

    with patch("google.generativeai.GenerativeModel") as mock_model_cls:
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_model_cls.return_value = mock_model_instance

        payload = {
            "text": "crea la tabla Rol con atributos id entero y nombre string",
            "current_model": {"classes": [{"name": "Usuario"}]},
            "initial_context": "Usuario"
        }
        response = client.post("/api/v1/voice/parse-intent", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "commands" in data
        assert len(data["commands"]) == 1
        assert data["commands"][0]["className"] == "Rol"

def test_parse_intent_fallback_to_cohere_on_gemini_failure(client):
    with patch("app.modules.voice.router.parse_with_gemini", side_effect=Exception("Gemini quota exceeded")):
        with patch("app.modules.voice.router.parse_with_cohere") as mock_cohere:
            mock_cohere.return_value = [{"type": "CREATE_CLASS", "className": "Rol"}]
            with patch("app.modules.voice.router.settings") as mock_settings:
                mock_settings.GEMINI_API_KEY = "dummy_gemini"
                mock_settings.COHERE_API_KEY = "dummy_cohere"

                payload = {
                    "text": "crea la tabla Rol",
                    "current_model": {"classes": []}
                }
                response = client.post("/api/v1/voice/parse-intent", json=payload)
                assert response.status_code == 200
                data = response.json()
                assert len(data["commands"]) == 1
                assert data["commands"][0]["className"] == "Rol"
                assert mock_cohere.called

def test_parse_intent_unconfigured_api_keys(client):
    with patch("app.modules.voice.router.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = ""
        mock_settings.COHERE_API_KEY = ""
        payload = {"text": "crea una tabla"}
        response = client.post("/api/v1/voice/parse-intent", json=payload)
        assert response.status_code == 422

def test_parse_intent_both_fail(client):
    with patch("app.modules.voice.router.parse_with_gemini", side_effect=Exception("Gemini error")):
        with patch("app.modules.voice.router.parse_with_cohere", side_effect=Exception("Cohere error")):
            with patch("app.modules.voice.router.settings") as mock_settings:
                mock_settings.GEMINI_API_KEY = "dummy_gemini"
                mock_settings.COHERE_API_KEY = "dummy_cohere"

                payload = {"text": "crea una tabla"}
                response = client.post("/api/v1/voice/parse-intent", json=payload)
                assert response.status_code == 500
                assert "Fallaron todos los proveedores" in response.json()["detail"]
