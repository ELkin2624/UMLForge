from pydantic import Field
from app.core.uml_core.enums import RelationshipKind

from .element import UMLElement


class UMLRelationship(UMLElement):
    """
    Representa una relación entre dos elementos del modelo (clases, componentes, etc.).
    Utiliza referencias mediante UUIDs para `source` y `target`.
    """

    type: RelationshipKind = Field(
        ..., description="Tipo de relación (asociación, generalización, etc.)"
    )
    source: str = Field(..., description="UUID del elemento origen")
    target: str = Field(..., description="UUID del elemento destino")
    source_multiplicity: str = Field(
        default="1", description="Multiplicidad en el lado origen (si aplica)"
    )
    target_multiplicity: str = Field(
        default="1", description="Multiplicidad en el lado destino (si aplica)"
    )
