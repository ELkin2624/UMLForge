from pathlib import Path

from app.modules.xmi.core.parser import parse_xmi_to_intermediate


def test_parse_synthetic_class_model() -> None:
    path = Path("examples/ea_synthetic_class_model.xmi")
    assert path.exists()
    content = path.read_bytes()

    doc = parse_xmi_to_intermediate(content)
    assert doc.model_name == "BarberiaModel"
    assert doc.model_id == "EAID_Model_Barberia"

    # Verificar elementos raíz
    element_names = [e.name for e in doc.root_elements]
    assert "Cliente" in element_names
    assert "Cita" in element_names
    assert "Cliente_Citas" in element_names

    # Verificar atributos de Cliente
    cliente_elem = next(e for e in doc.root_elements if e.name == "Cliente")
    attr_names = [
        c.name for c in cliente_elem.children if c.tag_name == "ownedAttribute"
    ]
    assert "id" in attr_names
    assert "nombre" in attr_names
    assert "telefono" in attr_names


def test_parse_synthetic_components_model() -> None:
    path = Path("examples/ea_synthetic_components_model.xmi")
    assert path.exists()
    content = path.read_bytes()

    doc = parse_xmi_to_intermediate(content)
    assert doc.model_name == "ArchitectureSystem"

    elem_names = [e.name for e in doc.root_elements]
    assert "IAuthService" in elem_names
    assert "Frontend" in elem_names
    assert "Backend" in elem_names
    assert "AuthConnector" in elem_names
