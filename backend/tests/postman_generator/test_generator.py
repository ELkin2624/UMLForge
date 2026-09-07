import json

from app.core.canonical_model.class_model import UMLAttribute, UMLClass
from app.core.canonical_model.model import UMLModel
from app.modules.postman.generator import (
    generate_postman_collection,
    generate_postman_environment,
)


def test_generate_postman_collection():
    model = UMLModel(
        id="test-project",
        classes=[
            UMLClass(
                id="550e8400-e29b-41d4-a716-446655440000",
                name="Cliente",
                attributes=[
                    UMLAttribute(
                        id="550e8400-e29b-41d4-a716-446655440001",
                        name="nombre",
                        type="String",
                    )
                ],
            )
        ],
    )

    collection = generate_postman_collection(model)

    # Validation against Pydantic models
    dumped = collection.model_dump(by_alias=True, exclude_none=True)
    json_str = json.dumps(dumped)
    assert json_str is not None

    assert collection.info.name == "test-project API"
    assert len(collection.item) == 1

    cliente_folder = collection.item[0]
    assert cliente_folder.name == "Cliente"
    assert len(cliente_folder.item) == 5

    # First item should be CREATE (POST)
    create_req = cliente_folder.item[0]
    assert create_req.name == "Create Cliente"
    assert create_req.request.method == "POST"
    assert create_req.request.url.raw == "{{baseUrl}}/api/clientes"

    # Check that test script captures ID
    script_lines = create_req.event[0].script["exec"]
    script_str = "\n".join(script_lines)
    assert 'pm.collectionVariables.set("clienteId", json.id);' in script_str


def test_generate_postman_environment():
    model = UMLModel(id="test-project", classes=[])

    env = generate_postman_environment(model)
    assert env.name == "test-project Environment"
    assert len(env.values) == 1
    assert env.values[0].key == "baseUrl"
    assert env.values[0].value == "http://localhost:8080"

    dumped = env.model_dump(by_alias=True, exclude_none=True)
    assert "_postman_variable_scope" in dumped
    assert dumped["_postman_variable_scope"] == "environment"
