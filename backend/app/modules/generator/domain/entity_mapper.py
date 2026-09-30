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

            # 1. Mapear relaciones y herencia primero
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

            # 2. Buscar el campo ID y mapear atributos ordinarios (excluyendo FKs de relaciones y duplicados)
            id_field = None
            fields = []
            seen_field_names = set()

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
                        if attr.name.lower() == "id":
                            field_info.name = "id"
                        id_field = field_info
                    continue

                # Si el atributo es una FK redundante de una relación @ManyToOne/@OneToOne propietaria, omitir
                if cls._is_fk_attribute(attr.name, relations):
                    continue

                norm_name = attr.name.lower().replace("_", "")
                if norm_name in seen_field_names:
                    continue
                seen_field_names.add(norm_name)

                fields.append(field_info)

            if not id_field:
                id_field = FieldInfo(
                    name="id",
                    java_type="Long",
                    sql_type="BIGINT",
                    is_primary_key=True,
                    is_nullable=False,
                )

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

    @classmethod
    def _is_fk_attribute(cls, attr_name: str, relations: list) -> bool:
        if attr_name.lower() == "id":
            return False

        def normalize(val: str) -> str:
            return val.lower().replace("_", "").replace("-", "").strip()

        norm_attr = normalize(attr_name)

        for rel in relations:
            if not rel.persistence_owner:
                continue
            if rel.relation_kind not in ("MANY_TO_ONE", "ONE_TO_ONE"):
                continue

            target_name = normalize(rel.target_entity)
            rel_name = normalize(rel.name)
            join_col = normalize(rel.join_column) if rel.join_column else ""

            candidates = {
                f"{target_name}id",
                f"id{target_name}",
                f"{rel_name}id",
                f"id{rel_name}",
                target_name,
                rel_name,
            }
            if join_col:
                candidates.add(join_col)
                if not join_col.endswith("id"):
                    candidates.add(f"{join_col}id")

            if norm_attr in candidates:
                return True

        return False

    @staticmethod
    def _to_snake_case(name: str) -> str:
        import re

        name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()

    @staticmethod
    def _to_camel_case(name: str) -> str:
        return name[0].lower() + name[1:]
