from uuid import uuid4

import pytest
from app.core.canonical_model import (
    Component,
    Connector,
    Dependency,
    Interface,
    Port,
    UMLModel,
    UMLOperation,
)
from pydantic import ValidationError


def test_component_creation() -> None:
    comp_id = uuid4()
    comp = Component(
        id=comp_id, name="AuthService", description="Authentication component"
    )
    assert comp.id == comp_id
    assert comp.name == "AuthService"
    assert comp.description == "Authentication component"


def test_interface_creation() -> None:
    iface_id = uuid4()
    op_id = uuid4()
    op = UMLOperation(id=op_id, name="login", return_type="Token")
    iface = Interface(id=iface_id, name="IAuthService", operations=[op])
    assert iface.id == iface_id
    assert iface.name == "IAuthService"
    assert len(iface.operations) == 1
    assert iface.operations[0].name == "login"


def test_port_creation_valid() -> None:
    port_id = uuid4()
    comp_id = uuid4()
    iface_id = uuid4()

    port_prov = Port(
        id=port_id,
        name="authPort",
        component_id=comp_id,
        interface_id=iface_id,
        kind="provided",
    )
    assert port_prov.kind == "provided"
    assert port_prov.interface_id == iface_id

    port_req = Port(
        name="dbPort",
        component_id=comp_id,
        interface_id=iface_id,
        kind="required",
    )
    assert port_req.kind == "required"


def test_port_invalid_kind() -> None:
    with pytest.raises(ValidationError):
        Port(
            name="invalidPort",
            component_id=uuid4(),
            interface_id=uuid4(),
            kind="other",  # type: ignore
        )


def test_port_missing_interface() -> None:
    with pytest.raises(ValidationError):
        Port(
            name="missingIfacePort",
            component_id=uuid4(),
            kind="provided",  # type: ignore
        )


def test_connector_creation() -> None:
    p1 = uuid4()
    p2 = uuid4()
    conn = Connector(name="AuthConn", source_port_id=p1, target_port_id=p2)
    assert conn.source_port_id == p1
    assert conn.target_port_id == p2
    assert conn.name == "AuthConn"


def test_dependency_creation() -> None:
    s_id = uuid4()
    t_id = uuid4()
    dep = Dependency(source_id=s_id, target_id=t_id, type="dependency")
    assert dep.source_id == s_id
    assert dep.target_id == t_id
    assert dep.type == "dependency"


def test_uml_model_with_components() -> None:
    comp = Component(id=uuid4(), name="Frontend")
    iface = Interface(id=uuid4(), name="IAuth")
    port = Port(
        id=uuid4(),
        name="p1",
        component_id=comp.id,
        interface_id=iface.id,
        kind="required",
    )

    model = UMLModel(
        id="arch_test",
        components=[comp],
        interfaces=[iface],
        ports=[port],
    )

    json_data = model.to_json()
    reloaded = UMLModel.from_json(json_data)

    assert len(reloaded.components) == 1
    assert reloaded.components[0].id == comp.id
    assert len(reloaded.interfaces) == 1
    assert len(reloaded.ports) == 1
    assert reloaded.ports[0].interface_id == iface.id
