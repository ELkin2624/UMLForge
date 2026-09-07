from pydantic import BaseModel, Field

from .field_info import FieldInfo
from .relation_info import RelationInfo


class EntityInfo(BaseModel):
    """
    Representa una entidad JPA completa lista para ser renderizada en plantillas.
    """

    class_name: str = Field(
        ..., description="Nombre de la clase Java en PascalCase (ej. 'Cliente')"
    )
    table_name: str = Field(
        ..., description="Nombre de la tabla física en SQL (ej. 'clientes')"
    )
    id_field: FieldInfo = Field(..., description="Campo que actúa como clave primaria")
    fields: list[FieldInfo] = Field(
        default_factory=list,
        description="Lista de atributos/columnas (sin incluir el ID)",
    )
    relations: list[RelationInfo] = Field(
        default_factory=list, description="Relaciones JPA con otras entidades"
    )
    parent_class: str | None = Field(
        default=None, description="Clase base si esta entidad hereda de otra"
    )
    has_children: bool = Field(
        default=False, description="Indica si es padre de otras clases"
    )
