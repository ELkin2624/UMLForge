from enum import Enum


class VisibilityKind(str, Enum):
    """
    UML 2.5.1: 7.3.3.4 VisibilityKind
    Determina la visibilidad de una característica (Feature).
    """

    PUBLIC = "public"
    PRIVATE = "private"
    PROTECTED = "protected"
    PACKAGE = "package"


class AggregationKind(str, Enum):
    """
    UML 2.5.1: 9.5.4 AggregationKind
    Indica si una Property representa una parte entera (agregación o composición)
    o simplemente una asociación regular.
    """

    NONE = "none"
    SHARED = "shared"
    COMPOSITE = "composite"


class ParameterDirectionKind(str, Enum):
    """
    UML 2.5.1: 9.4.4 ParameterDirectionKind
    Indica si el parámetro entra o sale.
    """

    IN = "in"
    OUT = "out"
    INOUT = "inout"
    RETURN = "return"


class RelationshipKind(str, Enum):
    """
    Tipos principales de relaciones soportadas para el subconjunto de UML.
    """

    ASSOCIATION = "association"
    GENERALIZATION = "generalization"
    DEPENDENCY = "dependency"
    REALIZATION = "realization"
    INTERFACE_REALIZATION = "interface_realization"
    COMPOSITION = "composition"
    AGGREGATION = "aggregation"


class ComponentKind(str, Enum):
    """
    Tipos de elementos que pueden conformar diagramas de componentes o despliegue.
    """

    COMPONENT = "component"
    ARTIFACT = "artifact"
    NODE = "node"
