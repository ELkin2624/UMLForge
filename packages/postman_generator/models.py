from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PostmanVariable(BaseModel):
    key: str
    value: str
    type: str = "string"


class PostmanEvent(BaseModel):
    listen: str
    script: dict[str, Any]


class PostmanHeader(BaseModel):
    key: str
    value: str
    type: str = "text"


class PostmanUrl(BaseModel):
    raw: str
    host: list[str]
    path: list[str]


class PostmanBody(BaseModel):
    mode: str = "raw"
    raw: str
    options: dict[str, Any] = Field(
        default_factory=lambda: {"raw": {"language": "json"}}
    )


class PostmanRequest(BaseModel):
    method: str
    header: list[PostmanHeader] = Field(default_factory=list)
    body: PostmanBody | None = None
    url: PostmanUrl


class PostmanResponse(BaseModel):
    pass


class PostmanItem(BaseModel):
    name: str
    event: list[PostmanEvent] = Field(default_factory=list)
    request: PostmanRequest | None = None
    response: list[PostmanResponse] = Field(default_factory=list)
    item: list["PostmanItem"] | None = None


class PostmanInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    schema_url: str = Field(
        alias="schema",
        default="https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    )


class PostmanCollection(BaseModel):
    info: PostmanInfo
    item: list[PostmanItem]
    variable: list[PostmanVariable] = Field(default_factory=list)


class PostmanEnvironment(BaseModel):
    id: str
    name: str
    values: list[PostmanVariable]
    _postman_variable_scope: str = "environment"

    def model_dump(self, **kwargs: Any) -> dict[str, Any]:
        # We need to inject _postman_variable_scope for Newman compatibility sometimes
        d = super().model_dump(**kwargs)
        d["_postman_variable_scope"] = "environment"
        return d
