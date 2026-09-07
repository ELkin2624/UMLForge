from pydantic import Field
from app.core.uml_core.enums import ParameterDirectionKind, VisibilityKind

from .element import UMLElement


class UMLParameter(UMLElement):
    """
    Representa un parámetro de una operación UML.
    """

    type: str = Field(..., description="Tipo de dato del parámetro")
    direction: ParameterDirectionKind = Field(
        default=ParameterDirectionKind.IN,
        description="Dirección del parámetro (in, out, inout, return)",
    )
    multiplicity: str = Field(default="1", description="Multiplicidad del parámetro")


class UMLOperation(UMLElement):
    """
    Representa una operación (método) de una clase o interfaz UML.
    """

    visibility: VisibilityKind = Field(
        default=VisibilityKind.PUBLIC, description="Visibilidad de la operación"
    )
    is_abstract: bool = Field(
        default=False, description="Indica si la operación es abstracta"
    )
    is_static: bool = Field(
        default=False, description="Indica si la operación es estática"
    )
    parameters: list[UMLParameter] = Field(
        default_factory=list, description="Parámetros de la operación"
    )
    return_type: str | None = Field(
        default=None,
        description="Tipo de retorno de la operación (puede representarse también como un parámetro con direction=return)",
    )
