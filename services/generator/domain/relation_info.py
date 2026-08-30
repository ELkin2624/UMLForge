from pydantic import BaseModel, Field


class RelationInfo(BaseModel):
    """
    Representa una relación entre dos entidades desde la perspectiva de persistencia (JPA).
    """

    name: str = Field(
        ..., description="Nombre de la relación / campo en Java (ej. 'citas')"
    )
    target_entity: str = Field(
        ..., description="Nombre de la entidad destino (ej. 'Cita')"
    )
    relation_kind: str = Field(
        ...,
        description="Estrategia JPA (ONE_TO_MANY, MANY_TO_ONE, ONE_TO_ONE, MANY_TO_MANY)",
    )
    persistence_owner: bool = Field(
        ...,
        description="Indica si esta entidad es la dueña de la relación (tiene el @JoinColumn o tabla intermedia)",
    )
    mapped_by: str | None = Field(
        default=None,
        description="Nombre del campo en el target si este lado no es el owner",
    )
    join_column: str | None = Field(
        default=None, description="Nombre de la columna física en BD si es el owner"
    )
    is_collection: bool = Field(
        default=False, description="Indica si el tipo en Java es Collection/List"
    )
