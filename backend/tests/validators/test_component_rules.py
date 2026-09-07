from uuid import uuid4

from app.core.canonical_model import (
    Component,
    Connector,
    Dependency,
    Interface,
    Port,
    UMLModel,
    UMLOperation,
)
from app.core.validators.component_rules import ComponentValidator
from app.core.validators.uml_validator import UMLValidator
from app.core.validators.validation_result import ValidationResult


def test_valid_component_model() -> None:
    c1 = Component(id=uuid4(), name="Frontend")
    c2 = Component(id=uuid4(), name="Backend")
    iface = Interface(
        id=uuid4(),
        name="IAuthService",
        operations=[UMLOperation(id=uuid4(), name="authenticate")],
    )

    p1 = Port(
        id=uuid4(),
        name="authReq",
        component_id=c1.id,
        interface_id=iface.id,
        kind="required",
    )
    p2 = Port(
        id=uuid4(),
        name="authProv",
        component_id=c2.id,
        interface_id=iface.id,
        kind="provided",
    )

    conn = Connector(
        id=uuid4(), name="AuthLink", source_port_id=p1.id, target_port_id=p2.id
    )
    dep = Dependency(id=uuid4(), source_id=c1.id, target_id=iface.id, type="dependency")

    model = UMLModel(
        id="valid_arch",
        components=[c1, c2],
        interfaces=[iface],
        ports=[p1, p2],
        connectors=[conn],
        dependencies=[dep],
    )

    result = UMLValidator().validate(model)
    assert result.valid is True
    assert len(result.errors) == 0


def test_duplicate_component_name() -> None:
    c1 = Component(id=uuid4(), name="Backend")
    c2 = Component(id=uuid4(), name="Backend")

    model = UMLModel(id="dup_test", components=[c1, c2])
    result = ValidationResult()
    ComponentValidator().validate_name_uniqueness(model, result)

    assert result.valid is False
    assert any("COMP-001" in err for err in result.errors)


def test_duplicate_interface_name() -> None:
    i1 = Interface(id=uuid4(), name="IDatabase")
    i2 = Interface(id=uuid4(), name="IDatabase")

    model = UMLModel(id="dup_iface", interfaces=[i1, i2])
    result = ValidationResult()
    ComponentValidator().validate_name_uniqueness(model, result)

    assert result.valid is False
    assert any("COMP-002" in err for err in result.errors)


def test_port_invalid_component_reference() -> None:
    iface = Interface(id=uuid4(), name="IAuth")
    port = Port(
        id=uuid4(),
        name="p1",
        component_id=uuid4(),  # No existe
        interface_id=iface.id,
        kind="provided",
    )

    model = UMLModel(id="port_test", interfaces=[iface], ports=[port])
    result = ValidationResult()
    ComponentValidator().validate_port_references(model, result)

    assert result.valid is False
    assert any("COMP-003" in err for err in result.errors)


def test_port_invalid_interface_reference() -> None:
    comp = Component(id=uuid4(), name="Service")
    port = Port(
        id=uuid4(),
        name="p1",
        component_id=comp.id,
        interface_id=uuid4(),  # No existe
        kind="provided",
    )

    model = UMLModel(id="port_test", components=[comp], ports=[port])
    result = ValidationResult()
    ComponentValidator().validate_port_references(model, result)

    assert result.valid is False
    assert any("COMP-004" in err for err in result.errors)


def test_connector_missing_ports() -> None:
    p1 = uuid4()
    p2 = uuid4()
    conn = Connector(id=uuid4(), source_port_id=p1, target_port_id=p2)

    model = UMLModel(id="conn_test", connectors=[conn])
    result = ValidationResult()
    ComponentValidator().validate_connectors(model, result)

    assert result.valid is False
    assert any("COMP-005" in err for err in result.errors)


def test_connector_incompatible_kinds() -> None:
    comp = Component(id=uuid4(), name="Comp")
    iface = Interface(id=uuid4(), name="Iface")
    p1 = Port(
        id=uuid4(),
        name="p1",
        component_id=comp.id,
        interface_id=iface.id,
        kind="provided",
    )
    p2 = Port(
        id=uuid4(),
        name="p2",
        component_id=comp.id,
        interface_id=iface.id,
        kind="provided",
    )
    conn = Connector(id=uuid4(), source_port_id=p1.id, target_port_id=p2.id)

    model = UMLModel(
        id="conn_test",
        components=[comp],
        interfaces=[iface],
        ports=[p1, p2],
        connectors=[conn],
    )
    result = ValidationResult()
    ComponentValidator().validate_connectors(model, result)

    assert result.valid is False
    assert any("COMP-008" in err for err in result.errors)


def test_connector_different_interfaces() -> None:
    comp = Component(id=uuid4(), name="Comp")
    iface1 = Interface(id=uuid4(), name="Iface1")
    iface2 = Interface(id=uuid4(), name="Iface2")
    p1 = Port(
        id=uuid4(),
        name="p1",
        component_id=comp.id,
        interface_id=iface1.id,
        kind="provided",
    )
    p2 = Port(
        id=uuid4(),
        name="p2",
        component_id=comp.id,
        interface_id=iface2.id,
        kind="required",
    )
    conn = Connector(id=uuid4(), source_port_id=p1.id, target_port_id=p2.id)

    model = UMLModel(
        id="conn_test",
        components=[comp],
        interfaces=[iface1, iface2],
        ports=[p1, p2],
        connectors=[conn],
    )
    result = ValidationResult()
    ComponentValidator().validate_connectors(model, result)

    assert result.valid is False
    assert any("COMP-009" in err for err in result.errors)


def test_dependency_missing_target() -> None:
    comp = Component(id=uuid4(), name="Comp")
    dep = Dependency(id=uuid4(), source_id=comp.id, target_id=uuid4())

    model = UMLModel(id="dep_test", components=[comp], dependencies=[dep])
    result = ValidationResult()
    ComponentValidator().validate_dependencies(model, result)

    assert result.valid is False
    assert any("COMP-011" in err for err in result.errors)
