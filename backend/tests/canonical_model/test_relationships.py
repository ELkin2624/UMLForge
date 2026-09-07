from app.core.canonical_model.class_model import UMLClass
from app.core.canonical_model.model import UMLModel
from app.core.canonical_model.relationship_model import UMLRelationship
from app.core.uml_core.enums import RelationshipKind


def test_relationship_source_target_resolution() -> None:
    """
    Prueba que una relación puede resolver correctamente su origen y destino
    basado en los UUIDs proporcionados en el modelo.
    """
    # Crear clases
    c_source = UMLClass(name="Origen")
    c_target = UMLClass(name="Destino")

    # Crear relación
    rel = UMLRelationship(
        name="RelacionTest",
        type=RelationshipKind.ASSOCIATION,
        source=str(c_source.id),
        target=str(c_target.id),
    )

    model = UMLModel(id="model-id", classes=[c_source, c_target], relationships=[rel])

    # Encontrar la clase origen por UUID
    found_source = next((c for c in model.classes if str(c.id) == rel.source), None)
    assert found_source is not None
    assert found_source.name == "Origen"

    # Encontrar la clase destino por UUID
    found_target = next((c for c in model.classes if str(c.id) == rel.target), None)
    assert found_target is not None
    assert found_target.name == "Destino"
