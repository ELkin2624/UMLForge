from typing import Any

from app.core.canonical_model.class_model import UMLClass
from app.core.canonical_model.model import UMLModel
from app.modules.generator.domain.entity_info import EntityInfo
from app.modules.generator.domain.entity_mapper import EntityMapper
from pydantic import BaseModel


class ApiResourceInfo(BaseModel):
    entity_name: str
    route: str
    id_type: str
    fields: list[dict[str, Any]]  # {"name": str, "type": str}
    create_fields: list[dict[str, Any]]
    update_fields: list[dict[str, Any]]
    response_fields: list[dict[str, Any]]


class ApiResourcePolicy:
    """
    Política para decidir si una clase se convierte en un recurso de la API.
    """

    @classmethod
    def is_resource(cls, uml_class: UMLClass) -> bool:
        return True


def map_entities_to_resources(entities: list[EntityInfo]) -> list[ApiResourceInfo]:
    """
    Mapea EntityInfo (modelo de persistencia real de Spring Boot) a ApiResourceInfo.
    Garantiza que Postman y Spring Boot compartan exactamente la misma ruta REST (resource_path)
    y los mismos campos de relación (FKs individuales y colecciones Many-to-Many).
    """
    resources = []

    for entity in entities:
        fields = [{"name": f.name, "type": f.java_type} for f in entity.fields]

        create_fields = list(fields)
        update_fields = list(fields)

        # Agregar campos de relación para persistence owners
        for rel in entity.relations:
            if rel.persistence_owner and rel.relation_kind in ("MANY_TO_ONE", "ONE_TO_ONE"):
                rel_field = {
                    "name": f"{rel.name}Id",
                    "type": rel.target_id_type,
                    "target_id_type": rel.target_id_type,
                    "is_relation": True,
                    "target_entity": rel.target_entity,
                    "relation_kind": rel.relation_kind,
                }
                create_fields.append(rel_field)
                update_fields.append(rel_field)
            elif rel.persistence_owner and rel.relation_kind == "MANY_TO_MANY":
                field_name = f"{rel.target_entity[0].lower() + rel.target_entity[1:]}Ids"
                rel_field = {
                    "name": field_name,
                    "type": f"List<{rel.target_id_type}>",
                    "target_id_type": rel.target_id_type,
                    "is_relation": True,
                    "is_collection": True,
                    "target_entity": rel.target_entity,
                    "relation_kind": rel.relation_kind,
                }
                create_fields.append(rel_field)
                update_fields.append(rel_field)

        response_fields = [{"name": entity.id_field.name, "type": entity.id_field.java_type}] + create_fields

        resources.append(
            ApiResourceInfo(
                entity_name=entity.class_name,
                route=entity.resource_path,
                id_type=entity.id_field.java_type,
                fields=fields,
                create_fields=create_fields,
                update_fields=update_fields,
                response_fields=response_fields,
            )
        )

    return resources


def map_model_to_resources(model: UMLModel) -> list[ApiResourceInfo]:
    """
    Sobrecarga de compatibilidad: mapea un UMLModel delegando a EntityMapper
    para mantener una única fuente de verdad.
    """
    entities = EntityMapper.map_entities(model)
    return map_entities_to_resources(entities)
