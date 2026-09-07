from app.modules.xmi.core.intermediate import XMIElement, XMIModelDocument
from app.modules.xmi.core.parser import parse_xmi_to_intermediate
from app.modules.xmi.core.writer import intermediate_to_xmi_xml


def test_intermediate_to_xmi_xml_serialization() -> None:
    doc = XMIModelDocument(
        doc_fingerprint="test_fp",
        model_id="EAID_Model_Test",
        model_name="TestModel",
        root_elements=[
            XMIElement(
                xmi_id="EAID_Class_1",
                xmi_type="uml:Class",
                tag_name="packagedElement",
                name="Persona",
                visibility="public",
                children=[
                    XMIElement(
                        xmi_id="EAID_Attr_1",
                        xmi_type="uml:Property",
                        tag_name="ownedAttribute",
                        name="nombre",
                        visibility="private",
                        type_name="String",
                    )
                ],
            )
        ],
    )

    xml_str = intermediate_to_xmi_xml(doc)
    assert 'xmlns:xmi="http://www.omg.org/spec/XMI/20131001"' in xml_str
    assert 'xmlns:uml="http://www.omg.org/spec/UML/20131001"' in xml_str
    assert 'name="TestModel"' in xml_str
    assert 'name="Persona"' in xml_str
    assert 'name="nombre"' in xml_str

    # Validar que el XML resultante es parseable de vuelta
    reparsed_doc = parse_xmi_to_intermediate(xml_str.encode("utf-8"))
    assert reparsed_doc.model_name == "TestModel"
    assert len(reparsed_doc.root_elements) == 1
    assert reparsed_doc.root_elements[0].name == "Persona"
