"""
Modelos neutrales intermedios para representación de elementos XMI desacoplados de XML y CanonicalModel.
"""

from pydantic import BaseModel, ConfigDict, Field


class XMIElement(BaseModel):
    """
    Representación neutral de un nodo o elemento XMI 2.5.1.
    """

    xmi_id: str = Field(..., description="Identificador XMI del elemento")
    xmi_type: str = Field(..., description="Tipo UML/XMI del elemento (ej. uml:Class)")
    tag_name: str = Field(..., description="Nombre local de la etiqueta XML original")
    name: str | None = Field(default=None, description="Nombre asignado al elemento")
    visibility: str | None = Field(default=None, description="Visibilidad declarada")
    is_abstract: bool = Field(default=False, description="Indica si es abstracto")
    is_static: bool = Field(default=False, description="Indica si es estático")
    direction: str | None = Field(
        default=None, description="Dirección del parámetro (in, out, return, etc.)"
    )

    # Tipos y valores
    type_ref: str | None = Field(
        default=None, description="Referencia a ID de otro elemento para el tipo"
    )
    type_name: str | None = Field(
        default=None, description="Nombre textual o primitivo del tipo (ej. String)"
    )
    lower_value: str | None = Field(
        default=None, description="Límite inferior de multiplicidad"
    )
    upper_value: str | None = Field(
        default=None, description="Límite superior de multiplicidad"
    )
    default_value: str | None = Field(
        default=None, description="Valor por defecto / inicial"
    )

    # Relaciones y conectores
    aggregation: str | None = Field(
        default=None, description="Tipo de agregación: none, shared o composite"
    )
    general_ref: str | None = Field(
        default=None, description="ID del elemento general en una generalización"
    )
    client_ref: str | None = Field(
        default=None, description="ID del cliente en una dependencia"
    )
    supplier_ref: str | None = Field(
        default=None, description="ID del proveedor/suplidor en una dependencia"
    )
    source_ref: str | None = Field(
        default=None, description="ID del puerto/rol origen en un conector"
    )
    target_ref: str | None = Field(
        default=None, description="ID del puerto/rol destino en un conector"
    )
    member_end_refs: list[str] = Field(
        default_factory=list, description="IDs de extremos miembros en asociaciones"
    )

    # Estructura jerárquica
    parent_id: str | None = Field(default=None, description="ID del elemento padre")
    children: list["XMIElement"] = Field(
        default_factory=list, description="Elementos hijos subordinados"
    )
    raw_attributes: dict[str, str] = Field(
        default_factory=dict, description="Atributos XML adicionales no estructurados"
    )

    model_config = ConfigDict(validate_assignment=True)


class XMIModelDocument(BaseModel):
    """
    Contenedor raíz para un documento XMI parseado a representación intermedia.
    """

    doc_fingerprint: str = Field(
        ..., description="Huella SHA-256 del contenido original"
    )
    model_id: str = Field(..., description="Identificador XMI del modelo raíz")
    model_name: str = Field(default="Model", description="Nombre del modelo")
    root_elements: list[XMIElement] = Field(
        default_factory=list, description="Elementos principales del modelo"
    )

    model_config = ConfigDict(validate_assignment=True)
