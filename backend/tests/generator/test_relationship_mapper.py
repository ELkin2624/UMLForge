import uuid

from app.core.canonical_model.relationship_model import UMLRelationship
from app.core.uml_core.enums import RelationshipKind

from app.modules.generator.domain.relationship_mapper import RelationshipMapper


def test_relationship_mapper_one_to_many():
    # Source: 1, Target: *
    rel = UMLRelationship(
        id=str(uuid.uuid4()),
        name="citas",
        type=RelationshipKind.ASSOCIATION,
        source=str(uuid.uuid4()),
        target=str(uuid.uuid4()),
        source_multiplicity="1",
        target_multiplicity="*",
    )

    # Evaluar desde source (1)
    info_source = RelationshipMapper.map_relationship(
        rel, is_source=True, target_class_name="Cita"
    )
    assert info_source.relation_kind == "ONE_TO_MANY"
    assert info_source.persistence_owner == False
    assert info_source.is_collection == True

    # Evaluar desde target (*)
    info_target = RelationshipMapper.map_relationship(
        rel, is_source=False, target_class_name="Cliente"
    )
    assert info_target.relation_kind == "MANY_TO_ONE"
    assert info_target.persistence_owner == True
    assert info_target.is_collection == False


def test_relationship_mapper_many_to_many():
    rel = UMLRelationship(
        id=str(uuid.uuid4()),
        name="roles",
        type=RelationshipKind.ASSOCIATION,
        source=str(uuid.uuid4()),
        target=str(uuid.uuid4()),
        source_multiplicity="*",
        target_multiplicity="*",
    )

    info_source = RelationshipMapper.map_relationship(
        rel, is_source=True, target_class_name="Role"
    )
    assert info_source.relation_kind == "MANY_TO_MANY"
    assert info_source.persistence_owner == True  # Source es owner por defecto

    info_target = RelationshipMapper.map_relationship(
        rel, is_source=False, target_class_name="User"
    )
    assert info_target.relation_kind == "MANY_TO_MANY"
    assert info_target.persistence_owner == False
