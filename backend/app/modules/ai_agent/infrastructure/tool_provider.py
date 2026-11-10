"""Proveedores de herramientas con errores explícitos y sin respuestas simuladas."""

import base64
import json
from typing import Any

import httpx
from google import genai
from google.genai import types

from app.core.config import settings


class ToolProvider:
    async def chat(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> dict[str, Any]:
        if settings.AI_PROVIDER == "ollama":
            headers = (
                {"Authorization": f"Bearer {settings.OLLAMA_API_TOKEN}"}
                if settings.OLLAMA_API_TOKEN
                else {}
            )
            async with httpx.AsyncClient(
                timeout=settings.OLLAMA_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(
                    f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat",
                    headers=headers,
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "messages": messages,
                        "tools": tools,
                        "stream": False,
                        "think": False,
                        "options": {
                            "temperature": 0.2,
                            "num_predict": 4096,
                            "num_ctx": 16384,
                        },
                    },
                )
                response.raise_for_status()
                message = response.json().get("message")
                if not isinstance(message, dict):
                    raise TypeError("El proveedor no devolvió una respuesta válida.")
                return message
        if not settings.GEMINI_API_KEY:
            raise ValueError("Gemini no está configurado.")
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        contents: list[Any] = []
        for message in messages[1:]:
            role = message["role"]
            if role == "tool":
                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=message["tool_name"],
                                response={"result": json.loads(message["content"])},
                            )
                        ],
                    )
                )
            elif role == "assistant" and message.get("_gemini_parts"):
                contents.append(
                    types.Content(role="model", parts=message["_gemini_parts"])
                )
            else:
                parts = [types.Part.from_text(text=message.get("content") or " ")]
                for image in message.get("images", []):
                    parts.append(
                        types.Part.from_bytes(
                            data=base64.b64decode(image),
                            mime_type=message.get("mime_type", "image/png"),
                        )
                    )
                contents.append(
                    types.Content(
                        role="model" if role == "assistant" else "user", parts=parts
                    )
                )
        declarations = [
            types.FunctionDeclaration(
                name=tool["function"]["name"],
                description=tool["function"]["description"],
                parameters_json_schema=tool["function"]["parameters"],
            )
            for tool in tools
        ]
        try:
            response = await client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=messages[0]["content"],
                    tools=[types.Tool(function_declarations=declarations)],
                    temperature=0.2,
                ),
            )
            parts = response.candidates[0].content.parts if response.candidates else []
            return {
                "role": "assistant",
                "content": "".join(p.text or "" for p in parts),
                "tool_calls": [
                    {
                        "function": {
                            "name": p.function_call.name,
                            "arguments": dict(p.function_call.args or {}),
                        }
                    }
                    for p in parts
                    if p.function_call
                ],
                "_gemini_parts": parts,
            }
        finally:
            await client.aio.aclose()
