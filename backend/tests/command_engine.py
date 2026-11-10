"""Ejecuta el motor compartido real sin un servidor HTTP para las pruebas."""

import asyncio
import json
from pathlib import Path
from typing import Any

RUNNER = Path(__file__).resolve().parents[2] / "packages/uml-commands/runner.mjs"


async def engine(self: Any, operation: str, payload: dict[str, Any]) -> dict[str, Any]:
    if operation == "busy":
        return {"busy": []}
    if operation in ("publish", "presence", "agent_enabled"):
        return {"ok": True}
    process = await asyncio.create_subprocess_exec(
        "node",
        str(RUNNER),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate(
        json.dumps({"operation": operation, "payload": payload}).encode()
    )
    if process.returncode:
        raise RuntimeError(stderr.decode())
    return json.loads(stdout)
