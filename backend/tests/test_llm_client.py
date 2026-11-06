"""El cliente del LLM nunca debe hacer pasar el respaldo local por una respuesta real."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.modules.ai_agent.infrastructure.llm_client import LLMClient
from app.modules.ai_agent.schemas import AgentStructuredOutput

CALL = dict(
    user_name="Ana",
    user_prompt="Crea el módulo de pagos con el patrón Strategy",
    private_history=[],
    shared_decisions=[],
    recent_audit_logs=[],
    canvas_snapshot={"classes": []},
)


def invoke(client: LLMClient):
    return asyncio.run(client.invoke_architect_agent(**CALL))


def fake_gemini(client: LLMClient, generate):
    client.api_key = "clave-de-prueba"
    client.client = SimpleNamespace(
        aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    )


def test_sin_api_key_la_respuesta_se_marca_como_simulada():
    result = invoke(LLMClient(api_key=""))
    assert result.simulated is True
    assert result.canvas_patches  # el respaldo sigue dando algo útil para desarrollo


def test_respuesta_real_de_gemini_no_esta_simulada():
    client = LLMClient(api_key="")
    payload = AgentStructuredOutput(reply_to_user="Listo", canvas_patches=[])

    async def generate(**kwargs):
        return SimpleNamespace(text=payload.model_dump_json())

    fake_gemini(client, generate)
    result = invoke(client)
    assert result.simulated is False
    assert result.reply_to_user == "Listo"


def test_si_gemini_falla_en_todos_los_modelos_se_marca_como_simulada():
    client = LLMClient(api_key="")

    async def generate(**kwargs):
        raise RuntimeError("cuota agotada")

    fake_gemini(client, generate)
    assert invoke(client).simulated is True


def test_el_modelo_no_puede_declararse_real_desde_su_salida_json():
    """Aunque el JSON del modelo traiga `simulated`, el servidor decide la procedencia."""
    client = LLMClient(api_key="")

    async def generate(**kwargs):
        return SimpleNamespace(text='{"reply_to_user": "x", "canvas_patches": [], "simulated": true}')

    fake_gemini(client, generate)
    assert invoke(client).simulated is False


def test_el_prompt_del_sistema_incluye_el_contrato_de_operaciones():
    client = LLMClient(api_key="")
    seen = {}

    async def generate(**kwargs):
        seen["system"] = kwargs["config"].system_instruction
        return SimpleNamespace(text='{"reply_to_user": "ok", "canvas_patches": []}')

    fake_gemini(client, generate)
    invoke(client)
    for op in ("UPDATE_CLASS", "DELETE_RELATION", "remove_attributes", "COBERTURA OBLIGATORIA"):
        assert op in seen["system"]


def test_ollama_local_devuelve_una_respuesta_real_y_esquema_estructurado():
    payload = AgentStructuredOutput(reply_to_user="Listo desde Ollama", canvas_patches=[])
    response = MagicMock()
    response.json.return_value = {"message": {"content": payload.model_dump_json()}}
    response.raise_for_status.return_value = None
    http = AsyncMock()
    http.post.return_value = response
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=http)
    context.__aexit__ = AsyncMock(return_value=None)

    with patch("app.modules.ai_agent.infrastructure.llm_client.httpx.AsyncClient", return_value=context):
        result = invoke(LLMClient(api_key="", provider="ollama", ollama_model="qwen3.5:4b"))

    assert result.simulated is False
    assert result.reply_to_user == "Listo desde Ollama"
    sent = http.post.call_args.kwargs["json"]
    assert sent["model"] == "qwen3.5:4b"
    assert sent["stream"] is False
    assert sent["format"]


def test_ollama_reintenta_si_se_piden_atributos_y_el_parche_llega_vacio():
    first = AgentStructuredOutput(
        reply_to_user="Creé Perro con atributos.",
        canvas_patches=[{"op": "ADD_CLASS", "target_name": "Perro", "payload": {}, "reason": "x"}],
    )
    repaired = AgentStructuredOutput(
        reply_to_user="Creé Perro.",
        canvas_patches=[
            {
                "op": "ADD_CLASS",
                "target_name": "Perro",
                "payload": {"attributes": [{"name": "nombre", "type": "String"}]},
                "reason": "x",
            }
        ],
    )
    client = LLMClient(api_key="", provider="ollama")
    client._ollama_structured_response = AsyncMock(side_effect=[first, repaired])  # type: ignore[method-assign]

    result = asyncio.run(
        client.invoke_architect_agent(
            **{**CALL, "user_prompt": "Crea Perro con atributos nombre y edad"}
        )
    )
    assert result.simulated is False
    assert result.canvas_patches[0].payload["attributes"][0]["name"] == "nombre"
    assert client._ollama_structured_response.await_count == 2


def test_la_notacion_uml_de_visibilidad_se_normaliza_para_el_editor():
    output = AgentStructuredOutput(
        reply_to_user="ok",
        canvas_patches=[
            {
                "op": "ADD_CLASS",
                "target_name": "Perro",
                "payload": {"attributes": [{"name": "nombre", "type": "String", "visibility": "+"}]},
                "reason": "x",
            }
        ],
    )
    assert output.canvas_patches[0].payload["attributes"][0]["visibility"] == "public"
