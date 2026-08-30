from typing import Any

from canonical_model.class_model import UMLClass
from canonical_model.model import UMLModel
from pydantic import BaseModel

from .naming import pluralize, to_snake_case


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
    Actualmente, todas las clases del modelo UML se consideran persistibles
    y por tanto, se mapean a recursos.
    """

    @classmethod
    def is_resource(cls, uml_class: UMLClass) -> bool:
        # Aquí se podrían descartar clases abstractas, enums o interfaces
        # si se agregaran al modelo canónico.
        return True


def map_model_to_resources(model: UMLModel) -> list[ApiResourceInfo]:
    resources = []
    for cls in model.classes:
        if not ApiResourcePolicy.is_resource(cls):
            continue

        fields = [{"name": attr.name, "type": attr.type} for attr in cls.attributes]

        # En esta Fase asumimos ID autogenerado, así que no va en CREATE.
        # Si el modelo tiene ID explícito (es común), lo separamos.
        # Buscamos si existe un campo "id" explícitamente, pero en Spring generamos Long id.
        create_fields = [f for f in fields if f["name"].lower() != "id"]
        update_fields = [f for f in fields if f["name"].lower() != "id"]
        response_fields = fields

        id_field = next((f for f in fields if f["name"].lower() == "id"), None)
        id_type = id_field["type"] if id_field else "Long"

        resources.append(
            ApiResourceInfo(
                entity_name=cls.name,
                route=to_snake_case(pluralize(cls.name)).replace(
                    "_", "-"
                ),  # o a plural
                id_type=id_type,
                fields=fields,
                create_fields=create_fields,
                update_fields=update_fields,
                response_fields=response_fields,
            )
        )

    return resources
