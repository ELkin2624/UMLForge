from canonical_model.model import UMLModel

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

                if attr.is_primary_key:
                    id_field = field_info
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

            # Mapear relaciones
            relations = []
            for rel in model.relationships:
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
                    # Si no es owner, el owner (target) tendrá un campo apuntando a nosotros.
                    # El nombre del campo por defecto en la otra clase es el nombre de nuestra clase en camelCase
                    # (pluralizado si era colección en el otro lado)
                    r.mapped_by = cls._to_camel_case(uml_class.name)
                    # NOTA: En un mapeo perfecto 100% fiel, buscaríamos la RelationInfo gemela generada para la otra clase
                    # y usaríamos su `name` exacto. Esta aproximación es suficiente para la heurística base.

            entity_info = EntityInfo(
                class_name=uml_class.name,
                table_name=table_name,
                id_field=id_field,
                fields=fields,
                relations=relations,
            )
            entities.append(entity_info)

        return entities

    @staticmethod
    def _to_snake_case(name: str) -> str:
        import re

        name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()

    @staticmethod
    def _to_camel_case(name: str) -> str:
        return name[0].lower() + name[1:]
