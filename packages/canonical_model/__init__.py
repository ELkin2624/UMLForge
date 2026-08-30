"""
Paquete canonical-model: Representa un modelo UML como objetos en memoria (Pydantic).
Contiene la estructura de datos que se usa para deserializar y almacenar
el estado del sistema. No realiza validación de reglas UML semánticas.
"""

from .class_model import UMLAttribute, UMLClass
from .component_model import (
    Component,
    Connector,
    Dependency,
    Interface,
    Port,
    UMLComponent,
    UMLConnector,
    UMLDependency,
    UMLInterface,
    UMLPort,
)
from .diagram_model import UMLDiagram
from .element import UMLElement
from .model import UMLModel
from .operation_model import UMLOperation, UMLParameter
from .relationship_model import UMLRelationship

__all__ = [
    "Component",
    "Connector",
    "Dependency",
    "Interface",
    "Port",
    "UMLAttribute",
    "UMLClass",
    "UMLComponent",
    "UMLConnector",
    "UMLDependency",
    "UMLDiagram",
    "UMLElement",
    "UMLInterface",
    "UMLModel",
    "UMLOperation",
    "UMLParameter",
    "UMLPort",
    "UMLRelationship",
]
