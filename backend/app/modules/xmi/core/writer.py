"""
Serializador genérico de modelo intermedio XMI a documento XML conforme a OMG XMI 2.5.1.
"""

from typing import Any

from lxml import etree

from .intermediate import XMIElement, XMIModelDocument
from .namespaces import (
    PRIMITIVE_TYPES_HREF_PREFIX,
    UML_NS,
    XMI_NS,
    clark_qname,
)

# Mapeo de prefijos para XMI 2.1 (compatible con StarUML)
STARUML_XMI_NS = "http://schema.omg.org/spec/XMI/2.1"
STARUML_UML_NS = "http://schema.omg.org/spec/UML/2.0"

NS_MAP = {
    "xmi": STARUML_XMI_NS,
    "uml": STARUML_UML_NS,
}

def _xmi_qname(tag: str) -> str:
    return f"{{{STARUML_XMI_NS}}}{tag}"

def _uml_qname(tag: str) -> str:
    return f"{{{STARUML_UML_NS}}}{tag}"


def _serialize_element_recursive(parent_xml: Any, elem: XMIElement) -> None:
    """
    Serializa recursivamente un XMIElement en un sub-árbol lxml.
    """
    # Determinar el tag adecuado (StarUML no usa namespace en tags hijos)
    tag_name = elem.tag_name or "packagedElement"
    xml_elem = etree.SubElement(parent_xml, tag_name)

    # Atributos esenciales
    xml_elem.set(_xmi_qname("id"), elem.xmi_id)
    if elem.xmi_type:
        xml_elem.set(_xmi_qname("type"), elem.xmi_type)

    if elem.name:
        xml_elem.set("name", elem.name)

    if elem.visibility:
        xml_elem.set("visibility", elem.visibility)

    if elem.is_abstract:
        xml_elem.set("isAbstract", "true")

    if elem.is_static:
        xml_elem.set("isStatic", "true")

    if elem.direction:
        xml_elem.set("direction", elem.direction)

    if elem.aggregation and elem.aggregation != "none":
        xml_elem.set("aggregation", elem.aggregation)

    if elem.general_ref:
        xml_elem.set("general", elem.general_ref)

    if elem.client_ref:
        xml_elem.set("client", elem.client_ref)

    if elem.supplier_ref:
        xml_elem.set("supplier", elem.supplier_ref)

    # Tipo de dato (Primitivo o referencia)
    if elem.type_ref:
        xml_elem.set("type", elem.type_ref)
    elif elem.type_name:
        type_elem = etree.SubElement(xml_elem, "type")
        type_elem.set(_xmi_qname("type"), "uml:PrimitiveType")
        type_elem.set("href", f"{PRIMITIVE_TYPES_HREF_PREFIX}{elem.type_name}")

    # Multiplicidad
    if elem.lower_value is not None:
        lower_elem = etree.SubElement(xml_elem, "lowerValue")
        lower_elem.set(_xmi_qname("type"), "uml:LiteralInteger")
        lower_elem.set(_xmi_qname("id"), f"{elem.xmi_id}_lower")
        lower_elem.set("value", str(elem.lower_value))

    if elem.upper_value is not None:
        upper_elem = etree.SubElement(xml_elem, "upperValue")
        upper_elem.set(
            _xmi_qname("type"),
            (
                "uml:LiteralUnlimitedNatural"
                if elem.upper_value == "*"
                else "uml:LiteralInteger"
            ),
        )
        upper_elem.set(_xmi_qname("id"), f"{elem.xmi_id}_upper")
        upper_elem.set("value", str(elem.upper_value))

    # Valor inicial
    if elem.default_value is not None:
        def_elem = etree.SubElement(xml_elem, "defaultValue")
        def_elem.set(_xmi_qname("type"), "uml:LiteralString")
        def_elem.set(_xmi_qname("id"), f"{elem.xmi_id}_default")
        def_elem.set("value", str(elem.default_value))

    # Extremos miembros en asociaciones
    for m_ref in elem.member_end_refs:
        m_elem = etree.SubElement(xml_elem, "memberEnd")
        m_elem.set(_xmi_qname("idref"), m_ref)

    # Extremos de conectores
    if elem.source_ref and elem.target_ref:
        end1 = etree.SubElement(xml_elem, "end")
        end1.set(_xmi_qname("type"), "uml:ConnectorEnd")
        end1.set(_xmi_qname("id"), f"{elem.xmi_id}_end1")
        end1.set("role", elem.source_ref)

        end2 = etree.SubElement(xml_elem, "end")
        end2.set(_xmi_qname("type"), "uml:ConnectorEnd")
        end2.set(_xmi_qname("id"), f"{elem.xmi_id}_end2")
        end2.set("role", elem.target_ref)

    # Elementos hijos subordinados
    for child in elem.children:
        _serialize_element_recursive(xml_elem, child)


def intermediate_to_xmi_xml(doc: XMIModelDocument) -> str:
    """
    Convierte un XMIModelDocument a un documento XML XMI 2.5.1 formateado.
    """
    root = etree.Element(_xmi_qname("XMI"), nsmap=NS_MAP)
    root.set(_xmi_qname("version"), "2.1")

    # Crear nodo <uml:Model>
    model_elem = etree.SubElement(root, _uml_qname("Model"))
    model_elem.set(_xmi_qname("type"), "uml:Model")
    model_elem.set(_xmi_qname("id"), doc.model_id)
    model_elem.set("name", doc.model_name)

    # Serializar elementos de nivel raíz
    for elem in doc.root_elements:
        _serialize_element_recursive(model_elem, elem)

    xml_bytes = etree.tostring(
        root,
        pretty_print=True,
        encoding="utf-8",
        xml_declaration=True,
    )
    return xml_bytes.decode("utf-8")
