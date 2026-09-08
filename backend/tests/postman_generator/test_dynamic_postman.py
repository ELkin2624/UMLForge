import uuid

from app.core.canonical_model.class_model import UMLAttribute, UMLClass
from app.core.canonical_model.model import UMLModel
from app.modules.generator.domain.entity_mapper import EntityMapper
from app.modules.generator.domain.domain_analyzer import DomainType
from app.modules.generator.domain.synthetic_data_generator import SyntheticDataGenerator
from app.modules.postman.generator import generate_postman_collection


def _uid():
    return str(uuid.uuid4())


def test_postman_dynamic_json_unquoted_types():
    """
    Valida que los campos numéricos (Integer, Double, BigDecimal) y booleanos
    se emitan SIN comillas en el JSON de Postman.
    """
    entity = UMLClass(
        id=_uid(),
        name="TypeEntity",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="edad", type="Integer"),
            UMLAttribute(id=_uid(), name="precio", type="BigDecimal"),
            UMLAttribute(id=_uid(), name="activo", type="Boolean"),
            UMLAttribute(id=_uid(), name="nombre", type="String"),
        ],
    )
    model = UMLModel(id="types-proj", classes=[entity])
    entities = EntityMapper.map_entities(model)
    dataset = SyntheticDataGenerator.generate(model, entities, DomainType.GENERIC)

    col = generate_postman_collection(model, ordered_entities=entities, dataset=dataset)
    folder = col.item[0]
    create_req = folder.item[0]
    raw_body = create_req.request.body.raw

    # Sin comillas en números y booleans
    assert '"edad": {{$randomInt}}' in raw_body
    assert '"precio": {{$randomPrice}}' in raw_body
    assert '"activo": true' in raw_body
    # Con comillas en strings
    assert '"nombre": "{{$randomFirstName}}"' in raw_body


def test_postman_test_script_captures_id():
    """
    Valida que el test script de la petición POST capture json.id y lo asigne a pm.collectionVariables.
    """
    entity = UMLClass(
        id=_uid(),
        name="CustomEntity",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="name", type="String"),
        ],
    )
    model = UMLModel(id="script-proj", classes=[entity])
    entities = EntityMapper.map_entities(model)

    col = generate_postman_collection(model, ordered_entities=entities)
    create_req = col.item[0].item[0]
    assert create_req.event is not None
    exec_lines = create_req.event[0].script["exec"]
    script_content = "\n".join(exec_lines)

    assert "pm.response.to.have.status(201)" in script_content
    assert 'pm.collectionVariables.set("customEntityId", json.id)' in script_content
