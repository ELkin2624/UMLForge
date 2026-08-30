"""
Paquete uml-core: Define conceptos, enumeraciones y constantes UML 2.5.1
sin depender de mecanismos de validación específicos (como Pydantic).
"""

from .constants import UML_VERSION
from .enums import (
    AggregationKind,
    ComponentKind,
    ParameterDirectionKind,
    RelationshipKind,
    VisibilityKind,
)
from .multiplicity import Multiplicity

__all__ = [
    "UML_VERSION",
    "AggregationKind",
    "ComponentKind",
    "Multiplicity",
    "ParameterDirectionKind",
    "RelationshipKind",
    "VisibilityKind",
]
