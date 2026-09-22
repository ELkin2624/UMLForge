from pydantic import BaseModel, ConfigDict, Field
from app.core.uml_core.constants import UML_VERSION

from .class_model import UMLClass
from .component_model import (
    UMLComponent,
    UMLConnector,
    UMLDependency,
    UMLInterface,
    UMLPort,
)
from .diagram_model import UMLDiagram
from .relationship_model import UMLRelationship


class UMLModel(BaseModel):
    """
    Contenedor raíz para un modelo UML.
    Es la representación en memoria (fuente de verdad) que será utilizada
    por los validadores, el generador de código, y otras herramientas.
    """

    id: str = Field(..., description="Identificador único del proyecto/modelo")
    name: str = Field(default="UML Model", description="Nombre del proyecto/modelo")
    uml_version: str = Field(
        default=UML_VERSION, description="Versión de UML utilizada"
    )
    classes: list[UMLClass] = Field(
        default_factory=list, description="Lista de clases del modelo"
    )
    components: list[UMLComponent] = Field(
        default_factory=list, description="Lista de componentes"
    )
    interfaces: list[UMLInterface] = Field(
        default_factory=list, description="Lista de interfaces"
    )
    ports: list[UMLPort] = Field(
        default_factory=list, description="Lista global de puertos de componentes"
    )
    connectors: list[UMLConnector] = Field(
        default_factory=list,
        description="Lista de conectores de ensamble entre puertos",
    )
    dependencies: list[UMLDependency] = Field(
        default_factory=list,
        description="Lista de dependencias entre elementos nombrados",
    )
    relationships: list[UMLRelationship] = Field(
        default_factory=list, description="Lista de relaciones"
    )
    diagrams: list[UMLDiagram] = Field(
        default_factory=list, description="Diagramas visuales asociados al modelo"
    )

    model_config = ConfigDict(validate_assignment=True)

    def to_json(self) -> str:
        """
        Serializa el modelo completo a una cadena JSON.
        """
        return self.model_dump_json(indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> "UMLModel":
        """
        Deserializa una cadena JSON a una instancia de UMLModel.
        """
        return cls.model_validate_json(json_str)
