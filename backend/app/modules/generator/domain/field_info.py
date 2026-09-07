from pydantic import BaseModel, Field


class FieldInfo(BaseModel):
    """
    Representa un atributo/campo dentro de una entidad generada.
    """

    name: str = Field(..., description="Nombre del campo en Java (ej. 'nombreCliente')")
    java_type: str = Field(..., description="Tipo de dato en Java (ej. 'String')")
    sql_type: str = Field(..., description="Tipo de dato en SQL (ej. 'VARCHAR(255)')")
    is_primary_key: bool = Field(default=False)
    is_nullable: bool = Field(default=True)
    min_length: int | None = Field(default=None)
    max_length: int | None = Field(default=None)
    min_value: float | None = Field(default=None)
    max_value: float | None = Field(default=None)
