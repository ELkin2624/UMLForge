import uuid

from app.core.canonical_model.class_model import UMLAttribute, UMLClass
from app.core.canonical_model.model import UMLModel
from app.modules.generator.domain.domain_analyzer import DomainAnalyzer, DomainType
from app.modules.generator.domain.entity_mapper import EntityMapper
from app.modules.generator.domain.synthetic_data_generator import SyntheticDataGenerator
from app.modules.postman.generator import generate_postman_collection


def _uid():
    return str(uuid.uuid4())


def test_coherence_between_data_sql_and_postman_variables():
    """
    Valida que los valores iniciales asignados a las variables de colección en Postman
    coincidan con los IDs deterministas generados en data.sql.
    """
    cls_a = UMLClass(
        id=_uid(),
        name="CoherentAlpha",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    cls_b = UMLClass(
        id=_uid(),
        name="CoherentBeta",
        attributes=[UMLAttribute(id=_uid(), name="id", type="UUID", is_primary_key=True)],
    )
    model = UMLModel(id="coherence-proj", classes=[cls_a, cls_b])
    entities = EntityMapper.map_entities(model)
    dataset = SyntheticDataGenerator.generate(model, entities, DomainType.GENERIC)

    # dataset.postman_defaults debe contener 'coherentAlphaId' y 'coherentBetaId'
    assert "coherentAlphaId" in dataset.postman_defaults
    assert "coherentBetaId" in dataset.postman_defaults

    alpha_default = dataset.postman_defaults["coherentAlphaId"]
    beta_default = dataset.postman_defaults["coherentBetaId"]

    # Validar que los primeros registros de SQL tengan exactamente esos IDs
    alpha_sql = next(s for s in dataset.sql_statements if "INSERT INTO coherent_alphas" in s)
    beta_sql = next(s for s in dataset.sql_statements if "INSERT INTO coherent_betas" in s)

    assert f"({alpha_default}," in alpha_sql or f"({alpha_default})" in alpha_sql
    assert f"('{beta_default}'" in beta_sql

    # Validar que la colección Postman tiene esas variables de colección
    col = generate_postman_collection(model, ordered_entities=entities, dataset=dataset)
    var_dict = {v.key: v.value for v in col.variable}
    assert var_dict["coherentAlphaId"] == alpha_default
    assert var_dict["coherentBetaId"] == beta_default


def test_generic_domain_fallback():
    """
    Valida que un modelo con nombres que no pertenecen a ningún dominio conocido
    caiga limpiamente en DomainType.GENERIC y produzca datos válidos y plausibles.
    """
    c1 = UMLClass(
        id=_uid(),
        name="XyzElement",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="propAlpha", type="String"),
            UMLAttribute(id=_uid(), name="amountVal", type="Double"),
        ],
    )
    c2 = UMLClass(
        id=_uid(),
        name="QrsContainer",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="labelStr", type="String"),
        ],
    )
    model = UMLModel(id="generic-test-proj", classes=[c1, c2])

    detected_domain = DomainAnalyzer.analyze(model)
    assert detected_domain == DomainType.GENERIC

    entities = EntityMapper.map_entities(model)
    dataset = SyntheticDataGenerator.generate(model, entities, detected_domain)
    assert len(dataset.sql_statements) > 0

    col = generate_postman_collection(model, ordered_entities=entities, domain=detected_domain, dataset=dataset)
    assert len(col.item) == 2
