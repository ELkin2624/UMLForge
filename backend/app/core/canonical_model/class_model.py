from pydantic import Field
from app.core.uml_core.enums import VisibilityKind

from .element import UMLElement
from .operation_model import UMLOperation


class UMLAttribute(UMLElement):
    """
    Representa un atributo o propiedad de una clase UML.
    """

    type: str = Field(
        ...,
        description="Tipo de dato del atributo (ej. String, UUID o el nombre de otra clase)",
    )
    visibility: VisibilityKind = Field(
        default=VisibilityKind.PRIVATE, description="Visibilidad del atributo"
    )
    multiplicity: str = Field(
        default="1", description="Multiplicidad del atributo (ej. 1, 0..*)"
    )
    is_static: bool = Field(
        default=False, description="Indica si el atributo es estático"
    )
    initial_value: str | None = Field(
        default=None, description="Valor inicial por defecto"
    )

    # Restricciones añadidas para soportar validación (Jakarta Validation / SQL)
    is_primary_key: bool = Field(
        default=False, description="Indica si es clave primaria"
    )
    is_nullable: bool = Field(default=True, description="Indica si permite nulos")
    min_length: int | None = Field(
        default=None, description="Longitud mínima (para strings)"
    )
    max_length: int | None = Field(
        default=None, description="Longitud máxima (para strings)"
    )
    min_value: float | None = Field(default=None, description="Valor mínimo (numérico)")
    max_value: float | None = Field(default=None, description="Valor máximo (numérico)")


class UMLClass(UMLElement):
    """
    Representa una clase UML en el modelo canónico.
    """

    is_abstract: bool = Field(
        default=False, description="Indica si la clase es abstracta"
    )
    attributes: list[UMLAttribute] = Field(
        default_factory=list, description="Lista de atributos de la clase"
    )
    operations: list["UMLOperation"] = Field(
        default_factory=list, description="Lista de operaciones de la clase"
    )
    owner_id: str | None = Field(
        default=None, description="ID de la clase dueña si esta clase está anidada"
    )
