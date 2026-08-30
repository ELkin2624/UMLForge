from pydantic import BaseModel, Field

from .entity_info import EntityInfo


class OpenAPIEndpoint(BaseModel):
    path: str
    method: str
    summary: str
    tags: list[str]


class OpenAPIInfo(BaseModel):
    title: str
    version: str
    endpoints: list[OpenAPIEndpoint] = Field(default_factory=list)


class OpenAPIMapper:
    @classmethod
    def map_openapi(cls, project_name: str, entities: list[EntityInfo]) -> OpenAPIInfo:
        info = OpenAPIInfo(title=f"{project_name} API", version="1.0.0")

        for entity in entities:
            plural_path = f"/api/{entity.table_name}"
            tag = entity.class_name

            info.endpoints.append(
                OpenAPIEndpoint(
                    path=plural_path,
                    method="GET",
                    summary=f"Get all {entity.class_name}s",
                    tags=[tag],
                )
            )
            info.endpoints.append(
                OpenAPIEndpoint(
                    path=f"{plural_path}/{{id}}",
                    method="GET",
                    summary=f"Get {entity.class_name} by ID",
                    tags=[tag],
                )
            )
            info.endpoints.append(
                OpenAPIEndpoint(
                    path=plural_path,
                    method="POST",
                    summary=f"Create {entity.class_name}",
                    tags=[tag],
                )
            )
            info.endpoints.append(
                OpenAPIEndpoint(
                    path=f"{plural_path}/{{id}}",
                    method="PUT",
                    summary=f"Update {entity.class_name}",
                    tags=[tag],
                )
            )
            info.endpoints.append(
                OpenAPIEndpoint(
                    path=f"{plural_path}/{{id}}",
                    method="DELETE",
                    summary=f"Delete {entity.class_name}",
                    tags=[tag],
                )
            )

        return info
