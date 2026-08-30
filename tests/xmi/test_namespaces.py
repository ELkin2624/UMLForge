from services.xmi.core.namespaces import (
    UML_NS,
    XMI_NS,
    clark_qname,
    match_uml_type,
    split_clark_qname,
)


def test_clark_qname_helpers() -> None:
    q = clark_qname(UML_NS, "Class")
    assert q == f"{{{UML_NS}}}Class"

    ns, local = split_clark_qname(q)
    assert ns == UML_NS
    assert local == "Class"

    ns_none, local_none = split_clark_qname("SimpleTag")
    assert ns_none == ""
    assert local_none == "SimpleTag"


def test_prefix_agnostic_matching() -> None:
    # 1. Clark notation
    assert match_uml_type(f"{{{UML_NS}}}Class", "Class")
    assert match_uml_type(f"{{{UML_NS}}}Component", "component")
    assert not match_uml_type(f"{{{XMI_NS}}}Class", "Class")

    # 2. Standard prefix uml:
    assert match_uml_type("uml:Class", "Class")
    assert match_uml_type("uml:Interface", "Interface")
    assert match_uml_type("uml:Association", "association")

    # 3. Custom prefix u: (or any prefix)
    assert match_uml_type("u:Class", "Class")
    assert match_uml_type("custom:Property", "Property")

    # 4. Simple local name
    assert match_uml_type("Class", "Class")
    assert match_uml_type("Operation", "operation")
    assert not match_uml_type(None, "Class")
