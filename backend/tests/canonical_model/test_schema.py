from pathlib import Path

from app.core.canonical_model.model import UMLModel


def test_schema_serialization_deserialization() -> None:
    """
    Prueba que un modelo UML se puede serializar a JSON
    y deserializar de vuelta sin perder información.
    """
    json_path = Path("examples/barberia.json")
    with open(json_path, "r", encoding="utf-8") as f:
        original_json = f.read()

    # Deserializar
    model = UMLModel.from_json(original_json)

    # Verificar algunos datos clave
    assert model.uml_version == "2.5.1"
    assert len(model.classes) == 3
    assert len(model.relationships) == 1
    assert len(model.diagrams) == 1

    # Serializar de nuevo
    serialized = model.to_json()

    # Deserializar por segunda vez para verificar idempotencia
    model2 = UMLModel.from_json(serialized)

    assert model.id == model2.id
    assert model.classes[0].name == model2.classes[0].name
