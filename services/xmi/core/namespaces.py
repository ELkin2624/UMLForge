"""
Constantes y utilidades para manejo de namespaces XML y XMI 2.5.1 conforme a OMG.
"""

# Namespaces estándar OMG UML 2.5.1 y XMI 2.5.1
UML_NS = "http://www.omg.org/spec/UML/20131001"
XMI_NS = "http://www.omg.org/spec/XMI/20131001"
PRIMITIVE_TYPES_HREF_PREFIX = "http://www.omg.org/spec/UML/20131001/PrimitiveTypes.xmi#"

# Diccionario estándar de namespaces para XPath y parsing
NAMESPACES = {
    "uml": UML_NS,
    "xmi": XMI_NS,
}


def clark_qname(ns: str, tag: str) -> str:
    """
    Retorna el nombre calificado en notación Clark: {namespace}tag
    """
    return f"{{{ns}}}{tag}"


def split_clark_qname(tag: str | object) -> tuple[str, str]:
    """
    Separa un tag en notación Clark en su tupla (namespace_uri, local_name).
    Si no tiene namespace o no es un string (ej. comentarios), retorna ("", str(tag)).
    """
    if not isinstance(tag, str):
        return "", ""
    if tag.startswith("{") and "}" in tag:
        ns, local = tag[1:].split("}", 1)
        return ns, local
    return "", tag


def match_uml_type(type_val: str | None, expected_local_name: str) -> bool:
    """
    Comprueba si un valor de tipo (ej. xmi:type o tag name) corresponde a un tipo UML esperado,
    resolviendo de manera agnóstica a prefijos (notación Clark, prefijo uml:, o nombre simple).
    """
    if not type_val:
        return False

    # 1. Si es notación Clark {http://www.omg.org/spec/UML/20131001}Class
    ns, local = split_clark_qname(type_val)
    if ns == UML_NS and local.lower() == expected_local_name.lower():
        return True

    # 2. Si tiene prefijo tipo 'uml:Class' o 'u:Class'
    if ":" in type_val:
        _, local = type_val.split(":", 1)
        if local.lower() == expected_local_name.lower():
            return True

    # 3. Si coincide directamente el nombre local
    return type_val.lower() == expected_local_name.lower()
