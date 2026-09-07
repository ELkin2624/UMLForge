from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from .element import UMLElement
from .operation_model import UMLOperation


class UMLComponent(UMLElement):
    """
    Representa un componente UML en el diagrama de componentes.
    """

    description: str | None = Field(
        default=None, description="Descripción opcional del componente"
    )

    model_config = ConfigDict(validate_assignment=True)


class UMLInterface(UMLElement):
    """
    Representa una interfaz UML.
    """

    description: str | None = Field(
        default=None, description="Descripción opcional de la interfaz"
    )
    operations: list[UMLOperation] = Field(
        default_factory=list, description="Operaciones definidas por la interfaz"
    )

    model_config = ConfigDict(validate_assignment=True)


class UMLPort(BaseModel):
    """
    Representa un puerto asociado a un componente UML.
    Entidad global que referencia a su componente y a su interfaz obligatoria.
    """

    id: UUID = Field(
        default_factory=uuid4, description="Identificador único del puerto"
    )
    name: str = Field(..., min_length=1, description="Nombre del puerto")
    component_id: UUID = Field(
        ..., description="UUID del componente al que pertenece el puerto"
    )
    interface_id: UUID = Field(
        ..., description="UUID de la interfaz que provee o requiere el puerto"
    )
    kind: Literal["provided", "required"] = Field(
        ..., description="Tipo de puerto: provided (provista) o required (requerida)"
    )

    model_config = ConfigDict(validate_assignment=True)


class UMLConnector(BaseModel):
    """
    Representa un conector de ensamble entre dos puertos.
    """

    id: UUID = Field(
        default_factory=uuid4, description="Identificador único del conector"
    )
    name: str | None = Field(default=None, description="Nombre opcional del conector")
    source_port_id: UUID = Field(..., description="UUID del puerto origen")
    target_port_id: UUID = Field(..., description="UUID del puerto destino")

    model_config = ConfigDict(validate_assignment=True)


class UMLDependency(BaseModel):
    """
    Representa una relación de dependencia entre elementos nombrados (clase, componente, interfaz).
    """

    id: UUID = Field(
        default_factory=uuid4, description="Identificador único de la dependencia"
    )
    source_id: UUID = Field(
        ..., description="UUID del elemento origen (clase, componente o interfaz)"
    )
    target_id: UUID = Field(
        ..., description="UUID del elemento destino (clase, componente o interfaz)"
    )
    type: Literal["dependency", "abstraction", "realization"] = Field(
        default="dependency", description="Tipo semántico de dependencia"
    )

    model_config = ConfigDict(validate_assignment=True)


# Aliases para máxima ergonomía y compatibilidad
Component = UMLComponent
Interface = UMLInterface
Port = UMLPort
Connector = UMLConnector
Dependency = UMLDependency
