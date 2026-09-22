"""
Serializador genérico de modelo intermedio XMI a documento XML conforme a OMG XMI 2.1 / Enterprise Architect.
"""

from typing import Any

from lxml import etree

from .intermediate import XMIElement, XMIModelDocument
from .namespaces import PRIMITIVE_TYPES_HREF_PREFIX

# Namespaces estándar XMI 2.1 conformes con Enterprise Architect (EA) y OMG UML 2.1
EA_XMI_NS = "http://schema.omg.org/spec/XMI/2.1"
EA_UML_NS = "http://schema.omg.org/spec/UML/2.1"

NS_MAP = {
    "xmi": EA_XMI_NS,
    "uml": EA_UML_NS,
}


def _xmi_qname(tag: str) -> str:
    return f"{{{EA_XMI_NS}}}{tag}"


def _uml_qname(tag: str) -> str:
    return f"{{{EA_UML_NS}}}{tag}"


def _serialize_element_recursive(parent_xml: Any, elem: XMIElement) -> None:
    """
    Serializa recursivamente un XMIElement en un sub-árbol lxml.
    """
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

    # Atributos no estructurados / adicionales (ej. association)
    for attr_name, attr_val in elem.raw_attributes.items():
        if attr_val is not None and attr_name not in xml_elem.attrib:
            xml_elem.set(attr_name, str(attr_val))

    # Tipo de dato (Primitivo o referencia de clasificador)
    if elem.type_ref:
        xml_elem.set("type", elem.type_ref)
        type_elem = etree.SubElement(xml_elem, "type")
        type_elem.set(_xmi_qname("idref"), elem.type_ref)
    elif elem.type_name:
        type_elem = etree.SubElement(xml_elem, "type")
        type_elem.set(_xmi_qname("type"), "uml:PrimitiveType")
        type_elem.set("href", f"{PRIMITIVE_TYPES_HREF_PREFIX}{elem.type_name}")

    # Multiplicidad (garantizar que lowerValue nunca sea '*' en LiteralInteger)
    if elem.lower_value is not None:
        lower_elem = etree.SubElement(xml_elem, "lowerValue")
        lower_elem.set(_xmi_qname("type"), "uml:LiteralInteger")
        low_val = "0" if str(elem.lower_value) == "*" else str(elem.lower_value)
        lower_elem.set("value", low_val)

    if elem.upper_value is not None:
        upper_elem = etree.SubElement(xml_elem, "upperValue")
        up_val = str(elem.upper_value)
        upper_elem.set(
            _xmi_qname("type"),
            (
                "uml:LiteralUnlimitedNatural"
                if up_val == "*"
                else "uml:LiteralInteger"
            ),
        )
        upper_elem.set("value", up_val)

    # Valor inicial
    if elem.default_value is not None:
        def_elem = etree.SubElement(xml_elem, "defaultValue")
        def_elem.set(_xmi_qname("type"), "uml:LiteralString")
        def_elem.set("value", str(elem.default_value))

    # Extremos miembros en asociaciones (<memberEnd xmi:idref="..."/>)
    for m_ref in elem.member_end_refs:
        m_elem = etree.SubElement(xml_elem, "memberEnd")
        m_elem.set(_xmi_qname("idref"), m_ref)

    # Extremos de conectores
    if elem.source_ref and elem.target_ref:
        end1 = etree.SubElement(xml_elem, "end")
        end1.set(_xmi_qname("type"), "uml:ConnectorEnd")
        end1.set("role", elem.source_ref)

        end2 = etree.SubElement(xml_elem, "end")
        end2.set(_xmi_qname("type"), "uml:ConnectorEnd")
        end2.set("role", elem.target_ref)

    # Elementos hijos subordinados
    for child in elem.children:
        _serialize_element_recursive(xml_elem, child)


def intermediate_to_xmi_xml(doc: XMIModelDocument) -> str:
    """
    Convierte un XMIModelDocument a un documento XML XMI 2.1 estándar y compatible con Enterprise Architect.
    """
    root = etree.Element(_xmi_qname("XMI"), nsmap=NS_MAP)
    root.set(_xmi_qname("version"), "2.1")

    # Documentación / Exporter compatible con Sparx Enterprise Architect
    doc_elem = etree.SubElement(root, _xmi_qname("Documentation"))
    doc_elem.set("exporter", "Enterprise Architect")
    doc_elem.set("exporterVersion", "6.5")

    # Crear nodo <uml:Model>
    model_elem = etree.SubElement(root, _uml_qname("Model"))
    model_elem.set(_xmi_qname("type"), "uml:Model")
    model_elem.set(_xmi_qname("id"), doc.model_id)
    model_elem.set("name", doc.model_name)

    # Serializar elementos de nivel raíz en el modelo
    for elem in doc.root_elements:
        _serialize_element_recursive(model_elem, elem)

    xml_bytes = etree.tostring(
        root,
        pretty_print=True,
        encoding="utf-8",
        xml_declaration=True,
    )
    return xml_bytes.decode("utf-8")
