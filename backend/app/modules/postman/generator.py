import json
from typing import Any

from app.core.canonical_model.model import UMLModel

from .examples import generate_create_body, generate_update_body
from .identifiers import deterministic_uuid
from .models import (
    PostmanBody,
    PostmanCollection,
    PostmanEnvironment,
    PostmanEvent,
    PostmanHeader,
    PostmanInfo,
    PostmanItem,
    PostmanRequest,
    PostmanUrl,
)
from .naming import to_camel_case
from .resource_mapper import map_model_to_resources
from .test_scripts import (
    generate_create_test_script,
    generate_delete_test_script,
    generate_get_by_id_test_script,
    generate_list_test_script,
    generate_update_test_script,
)
from .variables import generate_collection_variables, generate_environment_values


def _create_postman_event(listen: str, script_lines: list[str]) -> PostmanEvent:
    return PostmanEvent(
        listen=listen, script={"exec": script_lines, "type": "text/javascript"}
    )


def _build_url(route: str, entity_var: str | None = None) -> PostmanUrl:
    raw = f"{{{{baseUrl}}}}/api/{route}"
    path = ["api", route]
    if entity_var:
        raw += f"/{{{{{entity_var}Id}}}}"
        path.append(f"{{{{{entity_var}Id}}}}")
    return PostmanUrl(raw=raw, host=["{{baseUrl}}"], path=path)


def _build_request(
    method: str, url: PostmanUrl, body_dict: dict[str, Any] | None = None
) -> PostmanRequest:
    header = [PostmanHeader(key="Accept", value="application/json")]
    body = None
    if body_dict is not None:
        header.append(PostmanHeader(key="Content-Type", value="application/json"))
        body = PostmanBody(raw=json.dumps(body_dict, indent=2))

    return PostmanRequest(method=method, header=header, body=body, url=url)


def generate_postman_collection(
    model: UMLModel, base_url: str = "http://localhost:8080"
) -> PostmanCollection:
    resources = map_model_to_resources(model)
    collection_items = []

    for res in resources:
        entity_var = to_camel_case(res.entity_name)

        items = []

        # 1. CREATE (POST)
        items.append(
            PostmanItem(
                name=f"Create {res.entity_name}",
                event=[
                    _create_postman_event(
                        "test", generate_create_test_script(entity_var)
                    )
                ],
                request=_build_request(
                    "POST", _build_url(res.route), generate_create_body(res)
                ),
            )
        )

        # 2. LIST (GET)
        items.append(
            PostmanItem(
                name=f"List {res.entity_name}s",
                event=[_create_postman_event("test", generate_list_test_script())],
                request=_build_request("GET", _build_url(res.route)),
            )
        )

        # 3. GET BY ID (GET)
        items.append(
            PostmanItem(
                name=f"Get {res.entity_name}",
                event=[_create_postman_event("test", generate_get_by_id_test_script())],
                request=_build_request("GET", _build_url(res.route, entity_var)),
            )
        )

        # 4. UPDATE (PUT)
        items.append(
            PostmanItem(
                name=f"Update {res.entity_name}",
                event=[_create_postman_event("test", generate_update_test_script())],
                request=_build_request(
                    "PUT", _build_url(res.route, entity_var), generate_update_body(res)
                ),
            )
        )

        # 5. DELETE (DELETE)
        items.append(
            PostmanItem(
                name=f"Delete {res.entity_name}",
                event=[_create_postman_event("test", generate_delete_test_script())],
                request=_build_request("DELETE", _build_url(res.route, entity_var)),
            )
        )

        # Carpeta para el recurso
        collection_items.append(PostmanItem(name=res.entity_name, item=items))

    project_name = model.id
    info = PostmanInfo(name=f"{project_name} API")
    variables = generate_collection_variables(base_url)

    return PostmanCollection(info=info, item=collection_items, variable=variables)


def generate_postman_environment(
    model: UMLModel, base_url: str = "http://localhost:8080"
) -> PostmanEnvironment:
    project_name = model.id
    key = f"parcial1-sw1:{project_name}:postman:environment"

    return PostmanEnvironment(
        id=deterministic_uuid(key),
        name=f"{project_name} Environment",
        values=generate_environment_values(base_url),
    )
