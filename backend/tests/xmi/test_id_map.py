from uuid import UUID, uuid4

from app.modules.xmi.core.id_map import IDMapper


def test_id_mapper_preserves_valid_uuids() -> None:
    mapper = IDMapper(doc_fingerprint="test_fp")
    orig_uuid = uuid4()
    str_uuid = str(orig_uuid)

    result_uuid = mapper.register(str_uuid)
    assert result_uuid == orig_uuid
    assert mapper.get_uuid(str_uuid) == orig_uuid
    assert mapper.get_xmi_id(orig_uuid) == str_uuid


def test_id_mapper_deterministic_uuid5_for_alphanumeric() -> None:
    mapper1 = IDMapper(doc_fingerprint="fingerprint_a")
    mapper2 = IDMapper(doc_fingerprint="fingerprint_a")
    mapper3 = IDMapper(doc_fingerprint="fingerprint_b")

    ea_id = "EAID_7B2D3F4A_1234_5678"

    uuid1 = mapper1.register(ea_id)
    uuid2 = mapper2.register(ea_id)
    uuid3 = mapper3.register(ea_id)

    # Determinista con la misma huella
    assert isinstance(uuid1, UUID)
    assert uuid1 == uuid2
    assert mapper1.get_xmi_id(uuid1) == ea_id

    # Diferente con distinta huella de documento (evita colisiones)
    assert uuid1 != uuid3


def test_register_canonical_export() -> None:
    mapper = IDMapper()
    test_uuid = uuid4()

    # Si no existía xmi_id previo
    xmi_id = mapper.register_canonical(test_uuid, prefix="EAID_Class_")
    assert xmi_id.startswith("EAID_Class_")
    assert mapper.get_uuid(xmi_id) == test_uuid
    assert mapper.get_xmi_id(test_uuid) == xmi_id

    # Si ya existía un xmi_id registrado durante importación
    orig_ea_id = "EAID_Original_Node"
    imported_uuid = mapper.register(orig_ea_id)
    exported_xmi_id = mapper.register_canonical(imported_uuid, prefix="EAID_Fallback_")
    assert exported_xmi_id == orig_ea_id
