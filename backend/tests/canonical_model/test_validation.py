from app.core.canonical_model.class_model import UMLClass
from app.core.canonical_model.model import UMLModel
from app.core.canonical_model.relationship_model import UMLRelationship
from app.core.uml_core.enums import RelationshipKind
from app.core.validators.uml_validator import UMLValidator


def test_structural_validation_valid_model() -> None:
    """
    Prueba que un modelo con referencias válidas pase la validación.
    """
    c1 = UMLClass(name="C1")
    c2 = UMLClass(name="C2")
    rel = UMLRelationship(
        name="R1",
        type=RelationshipKind.ASSOCIATION,
        source=str(c1.id),
        target=str(c2.id),
    )

    model = UMLModel(id="m1", classes=[c1, c2], relationships=[rel])

    validator = UMLValidator()
    result = validator.validate(model)

    assert result.valid is True
    assert len(result.errors) == 0


def test_structural_validation_invalid_references() -> None:
    """
    Prueba que un modelo con referencias inválidas (UUIDs inexistentes) falle la validación estructural.
    """
    c1 = UMLClass(name="C1")

    # Relación que apunta a un destino que no está en el modelo
    rel = UMLRelationship(
        name="R_Invalid",
        type=RelationshipKind.ASSOCIATION,
        source=str(c1.id),
        target="uuid-inexistente",
    )

    model = UMLModel(id="m2", classes=[c1], relationships=[rel])  # c2 no está incluido

    validator = UMLValidator()
    result = validator.validate(model)

    assert result.valid is False
    assert len(result.errors) > 0
    assert "UML-002" in result.errors[0]  # Error de destino inexistente
