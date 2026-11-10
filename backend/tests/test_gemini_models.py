"""Selección de modelos de Gemini: configurable y con respaldo si uno falla."""

import asyncio
from types import SimpleNamespace

from app.core.config import settings
from app.modules.ai_agent.infrastructure import tool_provider
from app.modules.ai_agent.infrastructure.tool_provider import (
    ToolProvider,
    gemini_models,
)


def test_orden_modelo_principal_y_respaldo_sin_repetir(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_MODEL", "principal")
    monkeypatch.setattr(settings, "GEMINI_FALLBACK_MODELS", ["respaldo", "principal"])
    assert gemini_models() == ["principal", "respaldo"]


def test_el_agente_usa_el_respaldo_si_el_principal_falla(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "clave")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "retirado")
    monkeypatch.setattr(settings, "GEMINI_FALLBACK_MODELS", ["vigente"])
    llamados: list[str] = []

    async def generate_content(model, **_):
        llamados.append(model)
        if model == "retirado":
            raise RuntimeError("404 NOT_FOUND")
        part = SimpleNamespace(text="hecho", function_call=None)
        return SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[part]))])

    async def aclose():
        return None

    fake = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content), aclose=aclose))
    monkeypatch.setattr(tool_provider.genai, "Client", lambda **_: fake)
    messages = [{"role": "system", "content": "sistema"}, {"role": "user", "content": "hola"}]
    result = asyncio.run(ToolProvider().chat(messages, []))
    assert llamados == ["retirado", "vigente"]
    assert result["content"] == "hecho"
