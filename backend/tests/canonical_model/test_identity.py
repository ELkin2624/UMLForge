from uuid import UUID

from app.core.canonical_model.class_model import UMLClass


def test_element_generates_unique_uuid() -> None:
    """
    Prueba que si no se proporciona un UUID, se genere uno automáticamente,
    y que dos elementos distintos tengan UUIDs diferentes.
    """
    elem1 = UMLClass(name="Cliente")
    elem2 = UMLClass(name="Cita")

    assert elem1.id is not None
    assert isinstance(elem1.id, UUID)
    assert elem2.id is not None
    assert elem1.id != elem2.id


def test_element_accepts_existing_uuid() -> None:
    """
    Prueba que podemos asignar un UUID específico.
    """
    test_id = "11111111-1111-1111-1111-111111111111"
    elem = UMLClass(id=UUID(test_id), name="Servicio")
    assert str(elem.id) == test_id
