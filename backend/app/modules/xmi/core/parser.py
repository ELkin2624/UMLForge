"""
Parser seguro de documentos XML/XMI 2.5.1 a representación intermedia neutral.
"""

import hashlib
from typing import Any

from lxml import etree

from .intermediate import XMIElement, XMIModelDocument
from .namespaces import (
    PRIMITIVE_TYPES_HREF_PREFIX,
    UML_NS,
    XMI_NS,
    split_clark_qname,
)

MAX_XMI_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class XMIParserException(Exception):
    """Excepción base para errores de parsing XMI."""

    def __init__(self, message: str, code: str = "XMI_INVALID_XML") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


def create_secure_parser() -> etree.XMLParser:
    """
    Crea un parser lxml seguro contra ataques XXE, Billion Laughs, DTD externas y DoS.
    """
    return etree.XMLParser(
        resolve_entities=False,
        no_network=True,
        remove_comments=False,
        load_dtd=False,
        huge_tree=False,
    )


def _get_ns_agnostic_attr(attribs, suffix: str) -> str | None:
    for k, v in attribs.items():
        if k.endswith(suffix):
            return str(v)
    return None

def _extract_id(elem: Any, default_prefix: str = "elem") -> str:
    """Extrae el id del elemento buscando atributos que terminen en }id o id estándar."""
    xmi_id = elem.attrib.get("id") or _get_ns_agnostic_attr(elem.attrib, "}id")
    if not xmi_id:
        xmi_id = f"auto_{default_prefix}_{id(elem)}"
    return str(xmi_id)


def _extract_type(elem: Any) -> str:
    """Extrae el tipo semántico buscando atributos que terminen en }type o el nombre del tag."""
    xmi_type = _get_ns_agnostic_attr(elem.attrib, "}type")
    if xmi_type:
        return str(xmi_type)
    ns, local = split_clark_qname(elem.tag)
    if "UML" in ns.upper() or "UML" in ns:
        return f"uml:{local}"
    return local


def _extract_primitive_or_custom_type(elem: Any) -> tuple[str | None, str | None]:
    """
    Extrae la información de tipo de un atributo o parámetro.
    Retorna (type_ref, type_name).
    """
    # 1. Atributo type directo (sin namespace xmi, ya que xmi:type es el meta-tipo del nodo)
    direct_type = elem.attrib.get("type")
    if direct_type:
        if direct_type.startswith(PRIMITIVE_TYPES_HREF_PREFIX):
            return None, direct_type[len(PRIMITIVE_TYPES_HREF_PREFIX) :]
        if "#" in direct_type:
            return None, direct_type.split("#", 1)[1]
        # Si es un nombre de tipo primitivo común (String, Integer, int, etc.)
        if direct_type.lower() in (
            "string",
            "integer",
            "int",
            "boolean",
            "bool",
            "float",
            "double",
            "uuid",
            "long",
            "void",
        ):
            return None, direct_type
        # Puede ser un xmi:id referenciado
        return direct_type, None

    # 2. Nodo hijo <type>
    for child in elem:
        if not isinstance(child.tag, str):
            continue
        _, child_local = split_clark_qname(child.tag)
        if child_local == "type":
            # href a PrimitiveTypes
            href = child.attrib.get("href")
            if href and href.startswith(PRIMITIVE_TYPES_HREF_PREFIX):
                return None, href[len(PRIMITIVE_TYPES_HREF_PREFIX) :]
            if href and "#" in href:
                return None, href.split("#", 1)[1]

            idref = child.attrib.get("idref") or _get_ns_agnostic_attr(child.attrib, "}idref")
            if idref:
                return str(idref), None

            child_type = child.attrib.get("type") or _get_ns_agnostic_attr(child.attrib, "}type")
            if child_type:
                if child_type.startswith(PRIMITIVE_TYPES_HREF_PREFIX):
                    return None, child_type[len(PRIMITIVE_TYPES_HREF_PREFIX) :]
                _, t_name = (
                    child_type.split(":", 1) if ":" in child_type else ("", child_type)
                )
                if t_name not in ("PrimitiveType", "Class", "Interface"):
                    return None, t_name
                name_attr = child.attrib.get("name")
                if name_attr:
                    return None, name_attr

    return None, None


def _extract_multiplicity_and_defaults(
    elem: Any,
) -> tuple[str | None, str | None, str | None]:
    """
    Extrae (lower_value, upper_value, default_value) de los hijos subordinados.
    """
    lower = None
    upper = None
    default_val = None

    for child in elem:
        if not isinstance(child.tag, str):
            continue
        _, child_local = split_clark_qname(child.tag)
        if child_local == "lowerValue":
            lower = child.attrib.get("value", "0")
        elif child_local == "upperValue":
            upper = child.attrib.get("value", "1")
        elif child_local == "defaultValue":
            default_val = child.attrib.get("value")

    return lower, upper, default_val


def _parse_element_recursive(elem: Any, parent_id: str | None = None) -> XMIElement:
    """
    Transforma recursivamente un nodo lxml en un XMIElement neutral.
    """
    xmi_id = _extract_id(elem)
    xmi_type = _extract_type(elem)
    _, tag_name = split_clark_qname(elem.tag)

    name = elem.attrib.get("name")
    visibility = elem.attrib.get("visibility")
    is_abstract = elem.attrib.get("isAbstract", "false").lower() in ("true", "1")
    is_static = elem.attrib.get("isStatic", "false").lower() in ("true", "1")
    direction = elem.attrib.get("direction")
    aggregation = elem.attrib.get("aggregation")

    general_ref = elem.attrib.get("general")
    client_ref = elem.attrib.get("client")
    supplier_ref = elem.attrib.get("supplier")

    type_ref, type_name = _extract_primitive_or_custom_type(elem)
    lower_val, upper_val, default_val = _extract_multiplicity_and_defaults(elem)

    # Identificar extremos de conectores o roles
    source_ref = None
    target_ref = None
    member_end_refs: list[str] = []

    # Atributos brutos para preservar información no tipada
    raw_attribs: dict[str, str] = {}
    for k, v in elem.attrib.items():
        _, attr_local = split_clark_qname(k)
        raw_attribs[attr_local] = str(v)

    children: list[XMIElement] = []

    for child in elem:
        if not isinstance(child.tag, str):
            continue
        _, child_local = split_clark_qname(child.tag)

        # Extremos de asociación <memberEnd xmi:idref="..."/>
        if child_local == "memberEnd":
            m_ref = child.attrib.get("idref") or _get_ns_agnostic_attr(child.attrib, "}idref")
            if m_ref:
                member_end_refs.append(str(m_ref))

        # Extremos de conector <end role="..."/>
        elif child_local == "end":
            role_ref = (
                child.attrib.get("role")
                or child.attrib.get("idref")
                or _get_ns_agnostic_attr(child.attrib, "}idref")
            )
            if role_ref:
                if source_ref is None:
                    source_ref = str(role_ref)
                else:
                    target_ref = str(role_ref)

        # Sub-elementos modelados
        elif child_local not in ("type", "lowerValue", "upperValue", "defaultValue"):
            child_obj = _parse_element_recursive(child, parent_id=xmi_id)
            children.append(child_obj)

    return XMIElement(
        xmi_id=xmi_id,
        xmi_type=xmi_type,
        tag_name=tag_name,
        name=name,
        visibility=visibility,
        is_abstract=is_abstract,
        is_static=is_static,
        direction=direction,
        type_ref=type_ref,
        type_name=type_name,
        lower_value=lower_val,
        upper_value=upper_val,
        default_value=default_val,
        aggregation=aggregation,
        general_ref=general_ref,
        client_ref=client_ref,
        supplier_ref=supplier_ref,
        source_ref=source_ref,
        target_ref=target_ref,
        member_end_refs=member_end_refs,
        parent_id=parent_id,
        children=children,
        raw_attributes=raw_attribs,
    )


def parse_xmi_to_intermediate(content: bytes) -> XMIModelDocument:
    """
    Valida y parsea el contenido binario de un archivo XMI/XML a un XMIModelDocument.
    Aplica límites de tamaño y defensas de seguridad XML.
    """
    if len(content) > MAX_XMI_SIZE_BYTES:
        raise XMIParserException(
            f"El archivo XMI supera el tamaño máximo permitido de {MAX_XMI_SIZE_BYTES // (1024 * 1024)} MB.",
            code="XMI_INVALID_XML",
        )

    # Prohibir DOCTYPE y ENTITY para máxima seguridad contra XXE y Billion Laughs
    if b"<!doctype" in content[:8192].lower() or b"<!entity" in content[:8192].lower():
        raise XMIParserException(
            "Definiciones DOCTYPE o ENTITY no permitidas en documentos XMI por motivos de seguridad.",
            code="XMI_INVALID_XML",
        )

    # Calcular huella SHA-256 del documento
    doc_fingerprint = hashlib.sha256(content).hexdigest()[:16]

    parser = create_secure_parser()
    try:
        root = etree.fromstring(content, parser=parser)
    except etree.XMLSyntaxError as e:
        raise XMIParserException(
            f"Error de sintaxis XML: {e}", code="XMI_INVALID_XML"
        ) from e
    except Exception as e:
        raise XMIParserException(
            f"Error procesando documento XML: {e}", code="XMI_INVALID_XML"
        ) from e

    # Buscar el contenedor <uml:Model> o <uml:Package>
    model_elem = None
    _, root_local = split_clark_qname(root.tag)

    if root_local in ("Model", "Package"):
        model_elem = root
    else:
        for child in root:
            _, child_local = split_clark_qname(child.tag)
            c_type = child.attrib.get(f"{{{XMI_NS}}}type") or ""
            if child_local in ("Model", "Package") or c_type.endswith("Model"):
                model_elem = child
                break

    if model_elem is None:
        # Si la raíz contiene directamente elementos empaquetados
        model_elem = root

    model_id = _extract_id(model_elem, default_prefix="model")
    model_name = model_elem.attrib.get("name", "XMI_Imported_Model")

    def collect_root_elements(container: Any) -> list[XMIElement]:
        """
        Extrae los elementos packagedElement/ownedMember del contenedor dado.
        Si un hijo es un uml:Model o uml:Package, desciende recursivamente
        para aplanar su contenido (comportamiento de StarUML y EA con paquetes).
        """
        collected: list[XMIElement] = []
        for child in container:
            if not isinstance(child.tag, str):
                continue
            _, child_local = split_clark_qname(child.tag)
            if child_local in ("Extension", "documentation", ""):
                continue

            c_type = ""
            for k, v in child.attrib.items():
                if k.endswith("}type"):
                    c_type = str(v)
                    break
            
            local_type = c_type.split(":", 1)[-1] if ":" in c_type else c_type

            # Si el hijo es un sub-modelo o paquete, aplanarlo recursivamente
            if child_local in ("Model", "Package") or local_type in ("Model", "Package"):
                collected.extend(collect_root_elements(child))
            else:
                collected.append(_parse_element_recursive(child, parent_id=model_id))
        return collected

    root_elements: list[XMIElement] = collect_root_elements(model_elem)

    return XMIModelDocument(
        doc_fingerprint=doc_fingerprint,
        model_id=model_id,
        model_name=model_name,
        root_elements=root_elements,
    )
