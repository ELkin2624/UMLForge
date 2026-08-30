from pathlib import Path
from uuid import UUID

import pytest
from canonical_model.class_model import UMLAttribute, UMLClass
from canonical_model.model import UMLModel
from canonical_model.operation_model import UMLOperation, UMLParameter
from uml_core.enums import (
    ParameterDirectionKind,
    VisibilityKind,
)
from validators.uml_validator import UMLValidator

from services.xmi.core.intermediate import XMIElement, XMIModelDocument
from services.xmi.core.parser import parse_xmi_to_intermediate
from services.xmi.core.writer import intermediate_to_xmi_xml
from services.xmi.profiles.ea import (
    XMIReferenceNotFoundError,
    canonical_to_ea_intermediate,
    map_intermediate_to_canonical,
)


def test_import_synthetic_class_fixture() -> None:
    path = Path("examples/ea_synthetic_class_model.xmi")
    doc = parse_xmi_to_intermediate(path.read_bytes())
    model, _warnings = map_intermediate_to_canonical(doc)

    assert len(model.classes) == 2
    assert len(model.relationships) == 1

    cliente = next(c for c in model.classes if c.name == "Cliente")
    assert len(cliente.attributes) == 3
    assert len(cliente.operations) == 1
    assert cliente.operations[0].name == "registrar"
    assert cliente.operations[0].return_type == "Boolean"

    # Validar que el modelo pasa los validadores canónicos
    validator = UMLValidator()
    result = validator.validate(model)
    assert result.valid


def test_import_synthetic_components_fixture() -> None:
    path = Path("examples/ea_synthetic_components_model.xmi")
    doc = parse_xmi_to_intermediate(path.read_bytes())
    model, _warnings = map_intermediate_to_canonical(doc)

    assert len(model.components) == 2
    assert len(model.interfaces) == 1
    assert len(model.ports) == 2
    assert len(model.connectors) == 1
    assert len(model.dependencies) == 1

    # Validar con UMLValidator
    validator = UMLValidator()
    result = validator.validate(model)
    assert result.valid


def test_roundtrip_class_model() -> None:
    # 1. Crear modelo canónico original
    orig_model = UMLModel(
        id="11111111-1111-1111-1111-111111111111",
        classes=[
            UMLClass(
                id=UUID("22222222-2222-2222-2222-222222222222"),
                name="Usuario",
                attributes=[
                    UMLAttribute(
                        id=UUID("33333333-3333-3333-3333-333333333333"),
                        name="email",
                        type="String",
                        visibility=VisibilityKind.PRIVATE,
                        multiplicity="1",
                    )
                ],
                operations=[
                    UMLOperation(
                        id=UUID("44444444-4444-4444-4444-444444444444"),
                        name="activar",
                        visibility=VisibilityKind.PUBLIC,
                        return_type="void",
                        parameters=[
                            UMLParameter(
                                id=UUID("55555555-5555-5555-5555-555555555555"),
                                name="token",
                                type="String",
                                direction=ParameterDirectionKind.IN,
                            )
                        ],
                    )
                ],
            )
        ],
    )

    # 2. Canonical -> EA Intermediate -> XMI XML
    doc_out = canonical_to_ea_intermediate(orig_model)
    xml_str = intermediate_to_xmi_xml(doc_out)

    # 3. XMI XML -> EA Intermediate -> Canonical
    doc_in = parse_xmi_to_intermediate(xml_str.encode("utf-8"))
    re_model, _warnings = map_intermediate_to_canonical(doc_in)

    assert len(re_model.classes) == 1
    re_class = re_model.classes[0]
    assert re_class.name == "Usuario"
    assert len(re_class.attributes) == 1
    assert re_class.attributes[0].name == "email"
    assert re_class.attributes[0].type == "String"
    assert len(re_class.operations) == 1
    assert re_class.operations[0].name == "activar"
    assert len(re_class.operations[0].parameters) == 1
    assert re_class.operations[0].parameters[0].name == "token"


def test_unsupported_elements_warning() -> None:
    doc = XMIModelDocument(
        doc_fingerprint="fp_unsupported",
        model_id="M1",
        model_name="ModelWithActivity",
        root_elements=[
            XMIElement(
                xmi_id="ACT1",
                xmi_type="uml:Activity",
                tag_name="packagedElement",
                name="ProcesoNegocio",
            )
        ],
    )

    _model, warnings = map_intermediate_to_canonical(doc)
    assert len(warnings) == 1
    assert "uml:Activity" in warnings[0]


def test_missing_reference_raises_exception() -> None:
    doc = XMIModelDocument(
        doc_fingerprint="fp_missing_ref",
        model_id="M1",
        model_name="ModelBadRef",
        root_elements=[
            XMIElement(
                xmi_id="CONN1",
                xmi_type="uml:Connector",
                tag_name="packagedElement",
                name="BrokenConnector",
                source_ref=None,
                target_ref=None,
            )
        ],
    )

    with pytest.raises(XMIReferenceNotFoundError):
        map_intermediate_to_canonical(doc)
