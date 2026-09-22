from uuid import UUID, uuid4
from typing import Union
from pydantic import BaseModel, ConfigDict, Field


class UMLElement(BaseModel):
    """
    Clase base para todos los elementos del modelo canónico.
    Todo elemento tiene una identidad única (UUID o string) y un nombre visible.
    """

    id: Union[UUID, str] = Field(
        default_factory=uuid4, description="Identificador único del elemento"
    )
    name: str = Field(default="", description="Nombre visible del elemento")

    model_config = ConfigDict(validate_assignment=True)
