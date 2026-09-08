import json
import uuid
import pytest

from app.core.canonical_model.class_model import UMLAttribute, UMLClass
from app.core.canonical_model.model import UMLModel
from app.core.canonical_model.relationship_model import UMLRelationship
from app.core.uml_core.enums import RelationshipKind
from app.modules.generator.domain.entity_mapper import EntityMapper
from app.modules.generator.domain.schema_mapper import SchemaMapper
from app.modules.generator.domain.domain_analyzer import DomainType
from app.modules.generator.domain.dependency_graph import DependencyGraph
from app.modules.generator.domain.synthetic_data_generator import SyntheticDataGenerator
from app.modules.postman.generator import generate_postman_collection


def _uid():
    return str(uuid.uuid4())


def _create_model(classes: list[UMLClass], relationships: list[UMLRelationship]) -> UMLModel:
    return UMLModel(
        id=f"proj-{uuid.uuid4().hex[:8]}",
        classes=classes,
        relationships=relationships,
    )


def test_fk_normal_long():
    """Valida 1:N con claves foráneas Long/BIGINT y sustitución correcta en Postman."""
    parent_id = _uid()
    child_id = _uid()
    parent = UMLClass(
        id=parent_id,
        name="AlphaParent",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="name", type="String"),
        ],
    )
    child = UMLClass(
        id=child_id,
        name="AlphaChild",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="description", type="String"),
        ],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_parent_child",
        type=RelationshipKind.ASSOCIATION,
        source=parent_id,
        target=child_id,
        source_multiplicity="1",
        target_multiplicity="*",
    )
    model = _create_model([parent, child], [rel])
    entities = EntityMapper.map_entities(model)
    ordered = DependencyGraph.topological_sort(entities)

    # Orden topológico: AlphaParent primero, luego AlphaChild
    assert ordered[0].class_name == "AlphaParent"
    assert ordered[1].class_name == "AlphaChild"

    dataset = SyntheticDataGenerator.generate(model, ordered, DomainType.GENERIC)
    # data.sql debe contener INSERTs para alpha_parents y luego alpha_childs con alphaparent_id
    sql = "\n".join(dataset.sql_statements)
    assert "INSERT INTO alpha_parents" in sql
    assert "INSERT INTO alpha_childs" in sql
    assert "alphaparent_id" in sql

    # Postman collection
    col = generate_postman_collection(model, ordered_entities=ordered, dataset=dataset)
    col_json = col.model_dump_json()
    assert "AlphaParent" in col_json
    assert "AlphaChild" in col_json
    # AlphaChild debe referenciar a {{alphaParentId}} de forma no entrecomillada
    child_create = next(i for i in col.item[1].item if i.name == "Create AlphaChild")
    assert '"alphaParentId": {{alphaParentId}}' in child_create.request.body.raw


def test_fk_uuid():
    """Valida 1:N con claves foráneas UUID, formato UUID y entrecomillado en JSON."""
    parent_id = _uid()
    child_id = _uid()
    parent = UMLClass(
        id=parent_id,
        name="UuidParent",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="UUID", is_primary_key=True),
            UMLAttribute(id=_uid(), name="title", type="String"),
        ],
    )
    child = UMLClass(
        id=child_id,
        name="UuidChild",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="UUID", is_primary_key=True),
            UMLAttribute(id=_uid(), name="content", type="String"),
        ],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_uuid",
        type=RelationshipKind.ASSOCIATION,
        source=parent_id,
        target=child_id,
        source_multiplicity="1",
        target_multiplicity="*",
    )
    model = _create_model([parent, child], [rel])
    entities = EntityMapper.map_entities(model)
    ordered = DependencyGraph.topological_sort(entities)
    dataset = SyntheticDataGenerator.generate(model, ordered, DomainType.GENERIC)

    # El schema debe tener columna UUID
    schema = SchemaMapper.map_schema(ordered)
    child_table = next(t for t in schema.tables if t.name == "uuid_childs")
    fk_col = next(c for c in child_table.columns if c.name == "uuidparent_id")
    assert fk_col.sql_type == "UUID"

    # Postman collection debe entrecomillar la variable UUID: "{{uuidParentId}}"
    col = generate_postman_collection(model, ordered_entities=ordered, dataset=dataset)
    child_create = next(i for i in col.item[1].item if i.name == "Create UuidChild")
    assert '"uuidParentId": "{{uuidParentId}}"' in child_create.request.body.raw


def test_one_to_one():
    """Valida relación 1:1, columna foránea en el owner y no en el inverso."""
    owner_id = _uid()
    inverse_id = _uid()
    owner = UMLClass(
        id=owner_id,
        name="ProfileOwner",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="username", type="String"),
        ],
    )
    inverse = UMLClass(
        id=inverse_id,
        name="ProfileDetails",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="bio", type="String"),
        ],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_one_to_one",
        type=RelationshipKind.ASSOCIATION,
        source=owner_id,
        target=inverse_id,
        source_multiplicity="1",
        target_multiplicity="1",
    )
    model = _create_model([owner, inverse], [rel])
    entities = EntityMapper.map_entities(model)
    ordered = DependencyGraph.topological_sort(entities)

    e_owner = next(e for e in ordered if e.class_name == "ProfileOwner")
    e_inverse = next(e for e in ordered if e.class_name == "ProfileDetails")

    # Source es persistence owner
    assert any(r.persistence_owner and r.relation_kind == "ONE_TO_ONE" for r in e_owner.relations)
    assert any(not r.persistence_owner and r.relation_kind == "ONE_TO_ONE" for r in e_inverse.relations)


def test_one_to_many_and_many_to_one_bidirectional():
    """Valida que la bidireccionalidad no genera ciclos en el grafo de dependencias."""
    parent_id = _uid()
    child_id = _uid()
    parent = UMLClass(
        id=parent_id,
        name="BidirParent",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    child = UMLClass(
        id=child_id,
        name="BidirChild",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_bidir",
        type=RelationshipKind.ASSOCIATION,
        source=parent_id,
        target=child_id,
        source_multiplicity="1",
        target_multiplicity="*",
    )
    model = _create_model([parent, child], [rel])
    entities = EntityMapper.map_entities(model)
    # No debe arrojar SEED_CYCLE_DETECTED
    ordered = DependencyGraph.topological_sort(entities)
    assert len(ordered) == 2
    assert ordered[0].class_name == "BidirParent"


def test_many_to_many_seed_join_table():
    """Valida que N:M genera la tabla intermedia en schema.sql y sentencias INSERT en data.sql."""
    ent_a_id = _uid()
    ent_b_id = _uid()
    ent_a = UMLClass(
        id=ent_a_id,
        name="StudentEntity",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    ent_b = UMLClass(
        id=ent_b_id,
        name="CourseEntity",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_m2m",
        type=RelationshipKind.ASSOCIATION,
        source=ent_a_id,
        target=ent_b_id,
        source_multiplicity="*",
        target_multiplicity="*",
    )
    model = _create_model([ent_a, ent_b], [rel])
    entities = EntityMapper.map_entities(model)
    ordered = DependencyGraph.topological_sort(entities)

    schema = SchemaMapper.map_schema(ordered)
    join_table = next((t for t in schema.tables if "student_entitys_course_entitys" in t.name), None)
    assert join_table is not None
    assert sum(1 for fk in join_table.foreign_keys if "FOREIGN KEY" in fk) == 2

    dataset = SyntheticDataGenerator.generate(model, ordered, DomainType.GENERIC)
    sql = "\n".join(dataset.sql_statements)
    assert "INSERT INTO student_entitys_course_entitys" in sql


def test_many_to_many_request_contains_related_ids():
    """Valida que el DTO Request y el body de Postman contienen la lista de IDs relacionados."""
    ent_a_id = _uid()
    ent_b_id = _uid()
    ent_a = UMLClass(
        id=ent_a_id,
        name="TagOwner",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    ent_b = UMLClass(
        id=ent_b_id,
        name="TagTarget",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_m2m_dto",
        type=RelationshipKind.ASSOCIATION,
        source=ent_a_id,
        target=ent_b_id,
        source_multiplicity="*",
        target_multiplicity="*",
    )
    model = _create_model([ent_a, ent_b], [rel])
    entities = EntityMapper.map_entities(model)
    ordered = DependencyGraph.topological_sort(entities)
    dataset = SyntheticDataGenerator.generate(model, ordered, DomainType.GENERIC)

    col = generate_postman_collection(model, ordered_entities=ordered, dataset=dataset)
    owner_create = next(i for i in col.item[1].item if i.name == "Create TagOwner")
    assert "tagTargetIds" in owner_create.request.body.raw
    assert "{{tagTargetId}}" in owner_create.request.body.raw


def test_many_to_many_service_resolves_related_entities():
    """Valida que la plantilla de servicio generada incluye la inyección del repositorio y findAllById."""
    from app.modules.generator.infrastructure.jinja_renderer import JinjaRenderer
    from pathlib import Path

    templates_dir = Path(__file__).parent.parent.parent / "app" / "modules" / "generator" / "templates"
    renderer = JinjaRenderer(templates_dir)

    ent_a_id = _uid()
    ent_b_id = _uid()
    ent_a = UMLClass(
        id=ent_a_id,
        name="Article",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    ent_b = UMLClass(
        id=ent_b_id,
        name="Category",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_m2m_srv",
        type=RelationshipKind.ASSOCIATION,
        source=ent_a_id,
        target=ent_b_id,
        source_multiplicity="*",
        target_multiplicity="*",
    )
    model = _create_model([ent_a, ent_b], [rel])
    entities = EntityMapper.map_entities(model)
    article_ent = next(e for e in entities if e.class_name == "Article")

    ctx = {
        "package_name": "com.test",
        "entity": article_ent,
    }
    service_code = renderer.render("spring/service.java.j2", ctx)
    assert "CategoryRepository categoryRepository;" in service_code
    assert "categoryRepository.findAllById(" in service_code
    assert "ResourceNotFoundException" in service_code


def test_inheritance_joined():
    """Valida que la estrategia JOINED inserta en la superclase primero y luego en la subclase."""
    parent_id = _uid()
    child_id = _uid()
    parent = UMLClass(
        id=parent_id,
        name="ParentEntity",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="commonField", type="String"),
        ],
    )
    child = UMLClass(
        id=child_id,
        name="ChildEntity",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="specificField", type="String"),
        ],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_gen",
        type=RelationshipKind.GENERALIZATION,
        source=child_id,
        target=parent_id,
    )
    model = _create_model([parent, child], [rel])
    entities = EntityMapper.map_entities(model)
    ordered = DependencyGraph.topological_sort(entities)

    assert ordered[0].class_name == "ParentEntity"
    assert ordered[1].class_name == "ChildEntity"

    schema = SchemaMapper.map_schema(ordered)
    child_table = next(t for t in schema.tables if t.name == "child_entitys")
    assert any("REFERENCES parent_entitys(id)" in fk for fk in child_table.foreign_keys)


def test_composition():
    """Valida que en composición el contenedor va primero y la parte lleva CascadeType.ALL."""
    container_id = _uid()
    part_id = _uid()
    container = UMLClass(
        id=container_id,
        name="OrderEntity",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    part = UMLClass(
        id=part_id,
        name="OrderItemEntity",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_comp",
        type=RelationshipKind.COMPOSITION,
        source=container_id,
        target=part_id,
        source_multiplicity="1",
        target_multiplicity="*",
    )
    model = _create_model([container, part], [rel])
    entities = EntityMapper.map_entities(model)
    ordered = DependencyGraph.topological_sort(entities)

    assert ordered[0].class_name == "OrderEntity"
    assert ordered[1].class_name == "OrderItemEntity"

    e_order = next(e for e in ordered if e.class_name == "OrderEntity")
    rel_info = next(r for r in e_order.relations if r.target_entity == "OrderItemEntity")
    assert rel_info.cascade == "CascadeType.ALL"


def test_aggregation():
    """Valida que la agregación crea la referencia sin forzar CascadeType.ALL."""
    agg_owner_id = _uid()
    agg_target_id = _uid()
    agg_owner = UMLClass(
        id=agg_owner_id,
        name="DepartmentEntity",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    agg_target = UMLClass(
        id=agg_target_id,
        name="TeacherEntity",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_agg",
        type=RelationshipKind.AGGREGATION,
        source=agg_owner_id,
        target=agg_target_id,
        source_multiplicity="1",
        target_multiplicity="*",
    )
    model = _create_model([agg_owner, agg_target], [rel])
    entities = EntityMapper.map_entities(model)
    e_owner = next(e for e in entities if e.class_name == "DepartmentEntity")
    rel_info = next(r for r in e_owner.relations if r.target_entity == "TeacherEntity")
    assert rel_info.cascade is None


def test_nullable_and_required_fields():
    """Valida que se generen datos tanto para campos requeridos como opcionales."""
    entity = UMLClass(
        id=_uid(),
        name="NullTestEntity",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="mandatoryField", type="String", is_nullable=False),
            UMLAttribute(id=_uid(), name="optionalField", type="String", is_nullable=True),
        ],
    )
    model = _create_model([entity], [])
    entities = EntityMapper.map_entities(model)
    dataset = SyntheticDataGenerator.generate(model, entities, DomainType.GENERIC)
    row = dataset.entity_records["NullTestEntity"][0]
    assert "mandatoryField" in row
    assert "optionalField" in row


def test_unique_fields_repeated_execution():
    """Valida que los campos UNIQUE en Postman usen expresiones dinámicas para no colisionar."""
    entity = UMLClass(
        id=_uid(),
        name="UniqueTestEntity",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="email", type="String"),
            UMLAttribute(id=_uid(), name="codigo", type="String"),
        ],
    )
    model = _create_model([entity], [])
    entities = EntityMapper.map_entities(model)
    dataset = SyntheticDataGenerator.generate(model, entities, DomainType.GENERIC)
    col = generate_postman_collection(model, ordered_entities=entities, dataset=dataset)
    col_json = col.model_dump_json()

    # En Postman debe usar variables Faker dinámicas
    assert "{{$randomEmail}}" in col_json
    assert "{{$randomUUID}}" in col_json or "{{$randomInt}}" in col_json


def test_enum_attributes():
    """Valida que los tipos reconocidos o enumeraciones generen valores coherentes."""
    entity = UMLClass(
        id=_uid(),
        name="EnumTestEntity",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="estado", type="String"),
        ],
    )
    model = _create_model([entity], [])
    entities = EntityMapper.map_entities(model)
    dataset = SyntheticDataGenerator.generate(model, entities, DomainType.E_COMMERCE)
    row = dataset.entity_records["EnumTestEntity"][0]
    # En dominio E-Commerce, 'estado' debe provenir de la lista de estados
    assert row["estado"] in ("'PENDIENTE'", "'PAGADO'", "'ENVIADO'", "'ENTREGADO'")


def test_nonexistent_fk_returns_controlled_not_found():
    """Valida que el código del servicio incluye orElseThrow(ResourceNotFoundException)."""
    from app.modules.generator.infrastructure.jinja_renderer import JinjaRenderer
    from pathlib import Path

    templates_dir = Path(__file__).parent.parent.parent / "app" / "modules" / "generator" / "templates"
    renderer = JinjaRenderer(templates_dir)

    p_id = _uid()
    c_id = _uid()
    parent = UMLClass(
        id=p_id,
        name="ParentRel",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    child = UMLClass(
        id=c_id,
        name="ChildRel",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    rel = UMLRelationship(
        id=_uid(),
        name="rel_parent_child",
        type=RelationshipKind.ASSOCIATION,
        source=p_id,
        target=c_id,
        source_multiplicity="1",
        target_multiplicity="*",
    )
    model = _create_model([parent, child], [rel])
    entities = EntityMapper.map_entities(model)
    child_ent = next(e for e in entities if e.class_name == "ChildRel")

    service_code = renderer.render("spring/service.java.j2", {"package_name": "com.app", "entity": child_ent})
    assert "parentRelRepository.findById(" in service_code
    assert 'orElseThrow(() -> new ResourceNotFoundException("ParentRel not found with id: "' in service_code


def test_postman_endpoint_matches_generated_controller_mapping():
    """Valida que la ruta en Postman es exactamente idéntica a la anotación @RequestMapping del Controller."""
    entity = UMLClass(
        id=_uid(),
        name="DetailedEntityItem",
        attributes=[UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True)],
    )
    model = _create_model([entity], [])
    entities = EntityMapper.map_entities(model)
    ent_info = entities[0]

    # Fuente de verdad compartida
    route = ent_info.resource_path
    col = generate_postman_collection(model, ordered_entities=entities)
    item = col.item[0].item[0]
    expected_url = f"{{{{baseUrl}}}}/api/{route}"
    assert item.request.url.raw == expected_url
