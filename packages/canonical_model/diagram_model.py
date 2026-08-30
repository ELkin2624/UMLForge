from pydantic import BaseModel, Field


class UMLDiagram(BaseModel):
    """
    Representa la definición de un diagrama.
    El diagrama no posee los elementos reales, solo agrupa referencias
    a los IDs de los elementos para su renderizado.
    """

    id: str = Field(..., description="Identificador único del diagrama")
    name: str = Field(..., description="Nombre del diagrama")
    diagram_type: str = Field(
        ..., description="Tipo de diagrama (e.g., class, component)"
    )
    element_ids: list[str] = Field(
        default_factory=list,
        description="Lista de UUIDs de los elementos que aparecen en el diagrama",
    )
