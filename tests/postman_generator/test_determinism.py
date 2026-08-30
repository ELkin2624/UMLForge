from canonical_model.class_model import UMLClass
from canonical_model.model import UMLModel
from postman_generator.generator import (
    generate_postman_collection,
    generate_postman_environment,
)


def test_determinism():
    model1 = UMLModel(
        id="barberia",
        classes=[
            UMLClass(
                id="550e8400-e29b-41d4-a716-446655440000", name="Cliente", attributes=[]
            )
        ],
    )

    model2 = UMLModel(
        id="barberia",
        classes=[
            UMLClass(
                id="550e8400-e29b-41d4-a716-446655440000", name="Cliente", attributes=[]
            )
        ],
    )

    env1 = generate_postman_environment(model1)
    env2 = generate_postman_environment(model2)
    assert env1.id == env2.id

    col1 = generate_postman_collection(model1)
    col2 = generate_postman_collection(model2)

    # Dump dictionaries
    d1 = col1.model_dump()
    d2 = col2.model_dump()

    assert d1 == d2
