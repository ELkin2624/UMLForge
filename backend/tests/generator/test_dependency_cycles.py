import uuid
import pytest

from app.core.canonical_model.class_model import UMLAttribute, UMLClass
from app.core.canonical_model.model import UMLModel
from app.core.canonical_model.relationship_model import UMLRelationship
from app.core.uml_core.enums import RelationshipKind
from app.modules.generator.domain.dependency_graph import DependencyGraph
from app.modules.generator.domain.entity_mapper import EntityMapper
from app.modules.generator.domain.exceptions import GenerationError


def _uid():
    return str(uuid.uuid4())


def test_resolvable_self_reference_cycle():
    """
    Valida que una entidad auto-referenciada con clave foránea nullable (ej. árbol de categorías)
    se resuelva como un ciclo blando sin arrojar error.
    """
    cat_id = _uid()
    category = UMLClass(
        id=cat_id,
        name="CategoryTree",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="name", type="String"),
        ],
    )
    # Auto-referencia
    self_rel = UMLRelationship(
        id=_uid(),
        name="rel_self_cat",
        type=RelationshipKind.ASSOCIATION,
        source=cat_id,
        target=cat_id,
        source_multiplicity="0..1",
        target_multiplicity="*",
    )
    model = UMLModel(id="self-ref-proj", classes=[category], relationships=[self_rel])
    entities = EntityMapper.map_entities(model)

    ordered = DependencyGraph.topological_sort(entities)
    assert len(ordered) == 1
    assert ordered[0].class_name == "CategoryTree"


def test_unresolvable_hard_cycle_raises_seed_cycle_detected():
    """
    Valida que dos entidades con dependencias circulares duras e irresolubles (ambas con composición / no nullable)
    lancen una excepción estructurada GenerationError con código SEED_CYCLE_DETECTED.
    """
    ent_a_id = _uid()
    ent_b_id = _uid()
    entity_a = UMLClass(
        id=ent_a_id,
        name="CyclicAlpha",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="name", type="String"),
        ],
    )
    entity_b = UMLClass(
        id=ent_b_id,
        name="CyclicBeta",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="name", type="String"),
        ],
    )

    # A es composición de B (Hard: B depende de A)
    rel_1 = UMLRelationship(
        id=_uid(),
        name="rel_c1",
        type=RelationshipKind.COMPOSITION,
        source=ent_a_id,
        target=ent_b_id,
        source_multiplicity="1",
        target_multiplicity="*",
    )
    # B es composición de A (Hard: A depende de B) -> Ciclo duro irresoluble
    rel_2 = UMLRelationship(
        id=_uid(),
        name="rel_c2",
        type=RelationshipKind.COMPOSITION,
        source=ent_b_id,
        target=ent_a_id,
        source_multiplicity="1",
        target_multiplicity="*",
    )

    model = UMLModel(id="hard-cycle-proj", classes=[entity_a, entity_b], relationships=[rel_1, rel_2])
    entities = EntityMapper.map_entities(model)

    with pytest.raises(GenerationError) as exc_info:
        DependencyGraph.topological_sort(entities)

    assert "SEED_CYCLE_DETECTED" in str(exc_info.value)
