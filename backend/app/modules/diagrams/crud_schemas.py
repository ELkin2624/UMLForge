from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class DiagramCreate(BaseModel):
    name: str
    data: dict[str, Any] = {}


class DiagramUpdate(BaseModel):
    expected_revision: int | None = None
    name: str | None = None
    data: dict[str, Any] | None = None
    # Origen del cambio: "ai" cuando el cliente guarda parches aplicados por la IA.
    source: Literal["user", "ai"] = "user"


class DiagramResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    created_at: datetime
    updated_at: datetime
    my_role: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DiagramDetailResponse(DiagramResponse):
    layout: dict[str, Any] = {}
    data: dict[str, Any]
    version: int = 0
    # True si el agente de IA participa en la sala de este diagrama.
    agent_enabled: bool = False
    # True si el guardado creó una versión nueva (False si no hubo diferencias).
    version_created: bool | None = None


class OnBehalfOf(BaseModel):
    user_id: int | None = None
    name: str


class VersionAuthor(BaseModel):
    type: Literal["user", "ai"]
    user_id: int | None = None
    name: str
    on_behalf_of: OnBehalfOf | None = None


class VersionChange(BaseModel):
    op: Literal["added", "removed", "modified"]
    kind: str
    id: str
    name: str
    parent: str | None = None
    detail: str | None = None


class VersionSummary(BaseModel):
    diagram_id: int
    version: int
    author: VersionAuthor
    source: str
    created_at: datetime
    summary: str
    changes: list[VersionChange]
    restored_from: int | None = None


class VersionDetail(VersionSummary):
    data: dict[str, Any]
