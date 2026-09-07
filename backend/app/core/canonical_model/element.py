from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class UMLElement(BaseModel):
    """
    Clase base para todos los elementos del modelo canónico.
    Todo elemento tiene una identidad única (UUID) y un nombre visible.
    """

    id: UUID = Field(
        default_factory=uuid4, description="Identificador único del elemento"
    )
    name: str = Field(..., min_length=1, description="Nombre visible del elemento")

    model_config = ConfigDict(validate_assignment=True)
