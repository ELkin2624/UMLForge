import pytest

from services.xmi.core.parser import (
    MAX_XMI_SIZE_BYTES,
    XMIParserException,
    parse_xmi_to_intermediate,
)


def test_reject_files_exceeding_max_size() -> None:
    oversized_content = b"x" * (MAX_XMI_SIZE_BYTES + 1024)
    with pytest.raises(XMIParserException) as exc_info:
        parse_xmi_to_intermediate(oversized_content)
    assert "tamaño máximo" in str(exc_info.value.message)


def test_reject_xxe_external_entity_reading() -> None:
    # XML con intento de XXE intentando leer un archivo local
    xxe_xml = b"""<?xml version="1.0"?>
    <!DOCTYPE root [
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
    ]>
    <xmi:XMI xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20131001">
        <uml:Model xmi:type="uml:Model" name="&xxe;"/>
    </xmi:XMI>
    """
    with pytest.raises(XMIParserException) as exc_info:
        parse_xmi_to_intermediate(xxe_xml)
    assert exc_info.value.code == "XMI_INVALID_XML"


def test_billion_laughs_dos_attack_protection() -> None:
    # XML Bomb (Billion Laughs)
    xml_bomb = b"""<?xml version="1.0"?>
    <!DOCTYPE lolz [
        <!ENTITY lol "lol">
        <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
        <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
    ]>
    <xmi:XMI xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20131001">
        <uml:Model xmi:type="uml:Model" name="&lol3;"/>
    </xmi:XMI>
    """
    with pytest.raises(XMIParserException) as exc_info:
        parse_xmi_to_intermediate(xml_bomb)
    assert exc_info.value.code == "XMI_INVALID_XML"


def test_malformed_xml_rejection() -> None:
    malformed = b"<xmi:XMI><unclosed_tag>"
    with pytest.raises(XMIParserException) as exc_info:
        parse_xmi_to_intermediate(malformed)
    assert exc_info.value.code == "XMI_INVALID_XML"
