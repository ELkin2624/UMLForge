from pydantic import BaseModel, Field

from .entity_info import EntityInfo


class PostmanRequest(BaseModel):
    name: str
    method: str
    url: str
    body_json: str | None = None
    tests: list[str] = Field(default_factory=list)


class PostmanFolder(BaseModel):
    name: str
    requests: list[PostmanRequest] = Field(default_factory=list)


class PostmanInfo(BaseModel):
    collection_name: str
    folders: list[PostmanFolder] = Field(default_factory=list)


class PostmanMapper:
    @classmethod
    def map_postman(cls, project_name: str, entities: list[EntityInfo]) -> PostmanInfo:
        info = PostmanInfo(collection_name=f"{project_name} Collection")

        for entity in entities:
            folder = PostmanFolder(name=entity.class_name)
            base_url = f"{{{{baseUrl}}}}/api/{entity.table_name}"

            # GET All
            folder.requests.append(
                PostmanRequest(
                    name=f"Get All {entity.class_name}s",
                    method="GET",
                    url=base_url,
                    tests=[
                        "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"
                    ],
                )
            )

            # Generar JSON de ejemplo tonto para body
            body_props = []
            for f in entity.fields:
                if f.java_type == "String":
                    val = '"example"'
                elif f.java_type in ("Integer", "Long"):
                    val = "1"
                elif f.java_type == "Boolean":
                    val = "true"
                elif f.java_type == "Double":
                    val = "1.5"
                else:
                    val = '"value"'
                body_props.append(f'"{f.name}": {val}')
            json_body = "{\n  " + ",\n  ".join(body_props) + "\n}"

            # POST
            folder.requests.append(
                PostmanRequest(
                    name=f"Create {entity.class_name}",
                    method="POST",
                    url=base_url,
                    body_json=json_body,
                    tests=[
                        "pm.test('Status code is 201', function () { pm.response.to.have.status(201); });"
                    ],
                )
            )

            info.folders.append(folder)

        return info
