from app.core.canonical_model.model import UMLModel

from .entity_info import EntityInfo
from .field_info import FieldInfo
from .relationship_mapper import RelationshipMapper
from .type_mapper import TypeMapper


class EntityMapper:
    """
    Traduce clases UML a EntityInfo con todos sus campos y relaciones resueltos.
    """

    @classmethod
    def map_entities(cls, model: UMLModel) -> list[EntityInfo]:
        entities = []

        # Mapear los nombres de clases por ID para resolución rápida
        class_by_id = {str(c.id): c for c in model.classes}

        for uml_class in model.classes:
            table_name = cls._to_snake_case(uml_class.name) + "s"

            # Buscar el campo ID (suponemos que hay uno llamado 'id', o lo generamos)
            id_field = None
            fields = []

            for attr in uml_class.attributes:
                field_info = FieldInfo(
                    name=attr.name,
                    java_type=TypeMapper.get_java_type(attr.type),
                    sql_type=TypeMapper.get_sql_type(attr.type),
                    is_primary_key=attr.is_primary_key,
                    is_nullable=attr.is_nullable,
                    min_length=attr.min_length,
                    max_length=attr.max_length,
                    min_value=attr.min_value,
                    max_value=attr.max_value,
                )

                if attr.is_primary_key or attr.name.lower() == "id":
                    if not id_field:
                        field_info.is_primary_key = True
                        id_field = field_info
                    else:
                        fields.append(field_info)
                else:
                    fields.append(field_info)

            if not id_field:
                id_field = FieldInfo(
                    name="id",
                    java_type="Long",
                    sql_type="BIGINT",
                    is_primary_key=True,
                    is_nullable=False,
                )

            # Mapear relaciones y herencia
            relations = []
            parent_class = None
            
            for rel in model.relationships:
                if rel.type == "generalization":
                    if str(rel.source) == str(uml_class.id):
                        target_cls = class_by_id.get(str(rel.target))
                        if target_cls:
                            parent_class = target_cls.name
                    continue

                if str(rel.source) == str(uml_class.id):
                    target_cls = class_by_id.get(str(rel.target))
                    if target_cls:
                        rel_info = RelationshipMapper.map_relationship(
                            rel, is_source=True, target_class_name=target_cls.name
                        )
                        relations.append(rel_info)
                elif str(rel.target) == str(uml_class.id):
                    source_cls = class_by_id.get(str(rel.source))
                    if source_cls:
                        rel_info = RelationshipMapper.map_relationship(
                            rel, is_source=False, target_class_name=source_cls.name
                        )
                        relations.append(rel_info)

            # Segunda pasada para ajustar mappedBy usando el contexto local
            for r in relations:
                if not r.persistence_owner:
                    r.mapped_by = cls._to_camel_case(uml_class.name)
                    if r.relation_kind == "MANY_TO_MANY":
                        r.mapped_by += "s"

            resource_path = table_name

            entity_info = EntityInfo(
                class_name=uml_class.name,
                table_name=table_name,
                resource_path=resource_path,
                id_field=id_field,
                fields=fields,
                relations=relations,
                parent_class=parent_class,
            )
            entities.append(entity_info)

        # Segunda pasada general para setear has_children y resolver target_id_type
        entity_by_name = {e.class_name: e for e in entities}
        for entity in entities:
            if any(e.parent_class == entity.class_name for e in entities):
                entity.has_children = True
            for rel in entity.relations:
                target_ent = entity_by_name.get(rel.target_entity)
                if target_ent:
                    rel.target_id_type = target_ent.id_field.java_type
                    rel.target_id_field_name = target_ent.id_field.name
                    rel.target_table = target_ent.table_name

        return entities

    @staticmethod
    def _to_snake_case(name: str) -> str:
        import re

        name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()

    @staticmethod
    def _to_camel_case(name: str) -> str:
        return name[0].lower() + name[1:]
