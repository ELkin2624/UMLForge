"""Catálogo tipado de herramientas: el modelo propone, el coordinador ejecuta."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .schemas import CanvasPatchOperation


class Arguments(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Empty(Arguments):
    pass


class ClassTarget(Arguments):
    name: str = Field(min_length=1, max_length=150)


class Changes(Arguments):
    patches: list[CanvasPatchOperation] = Field(min_length=1, max_length=100)


Name = Annotated[str, Field(min_length=1, max_length=150)]
Visibility = Literal["public", "private", "protected", "package"]


class AttributeInput(Arguments):
    name: Name
    type: Name = "String"
    visibility: Visibility = "private"

    @field_validator("visibility", mode="before")
    @classmethod
    def visibility_symbol(cls, value: Any) -> Any:
        return {"+": "public", "-": "private", "#": "protected", "~": "package"}.get(
            value, value
        )


class AttributeUpdate(Arguments):
    name: Name
    new_name: Name | None = None
    type: Name | None = None
    visibility: Visibility | None = None


class OperationInput(Arguments):
    name: Name
    return_type: Name = "void"


class OperationUpdate(Arguments):
    name: Name
    new_name: Name | None = None
    return_type: Name | None = None


class AddClassPayload(Arguments):
    attributes: list[AttributeInput | Name] = Field(
        default_factory=list, max_length=100
    )
    operations: list[OperationInput | Name] = Field(
        default_factory=list, max_length=100
    )


class UpdateClassPayload(Arguments):
    new_name: Name | None = None
    add_attributes: list[AttributeInput | Name] = Field(
        default_factory=list, max_length=100
    )
    update_attributes: list[AttributeUpdate] = Field(
        default_factory=list, max_length=100
    )
    remove_attributes: list[Name] = Field(default_factory=list, max_length=100)
    add_operations: list[OperationInput] = Field(default_factory=list, max_length=100)
    update_operations: list[OperationUpdate] = Field(
        default_factory=list, max_length=100
    )
    remove_operations: list[Name] = Field(default_factory=list, max_length=100)


class RelationPayload(Arguments):
    source: Name
    target: Name
    type: (
        Literal[
            "association",
            "generalization",
            "aggregation",
            "composition",
            "dependency",
            "realization",
            "interface_realization",
        ]
        | None
    ) = None
    source_multiplicity: Name | None = None
    target_multiplicity: Name | None = None


class UpdateRelationPayload(RelationPayload):
    new_type: (
        Literal[
            "association",
            "generalization",
            "aggregation",
            "composition",
            "dependency",
            "realization",
            "interface_realization",
        ]
        | None
    ) = None
    new_source_multiplicity: Name | None = None
    new_target_multiplicity: Name | None = None


PAYLOADS = {
    "ADD_CLASS": AddClassPayload,
    "UPDATE_CLASS": UpdateClassPayload,
    "DELETE_CLASS": Empty,
    "ADD_RELATION": RelationPayload,
    "UPDATE_RELATION": UpdateRelationPayload,
    "DELETE_RELATION": RelationPayload,
}


class ProposeOperation(CanvasPatchOperation):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_payload(self) -> "ProposeOperation":
        if self.op == "ADD_RELATION" and not self.payload.get("type"):
            self.payload["type"] = "association"
        self.payload = (
            PAYLOADS[self.op]
            .model_validate(self.payload)
            .model_dump(exclude_unset=True, exclude_none=True)
        )
        return self


class Coordinates(Arguments):
    x: float = Field(ge=-1_000_000, le=1_000_000, allow_inf_nan=False)
    y: float = Field(ge=-1_000_000, le=1_000_000, allow_inf_nan=False)


class Move(ClassTarget, Coordinates):
    pass


TOOLS: dict[str, tuple[type[Arguments], str]] = {
    "get_diagram_summary": (
        Empty,
        "Leer el resumen vigente del diagrama y su revisión.",
    ),
    "get_class": (ClassTarget, "Leer una clase completa por nombre o ID."),
    "list_relationships": (Empty, "Leer las relaciones actuales."),
    "validate_model": (Empty, "Validar el modelo actual."),
    "analyze_normalization": (
        Empty,
        "Analizar el diseño de datos y sus formas normales.",
    ),
    "propose_changes": (
        ProposeOperation,
        "Preparar cambios UML. No afirmar que se aplicaron. Incluye TODOS los atributos y relaciones pedidos.",
    ),
    "point_at": (
        ClassTarget,
        "Mover el cursor del agente hacia una clase y seleccionarla.",
    ),
    "move_cursor": (
        Coordinates,
        "Mover el cursor propio a coordenadas del lienzo, sin editar el diagrama.",
    ),
    "move_class": (
        Move,
        "Preparar la posición final de una clase en coordenadas del lienzo.",
    ),
    "arrange_classes": (
        Empty,
        "Preparar una organización de las clases sin solapamientos.",
    ),
}


def definitions() -> list[dict[str, Any]]:
    result = []
    for name, (schema, description) in TOOLS.items():
        # Resolver $refs para proveedores que solo aceptan esquemas inline.
        raw = schema.model_json_schema()
        defs = raw.pop("$defs", {})

        def resolve(value: Any, defs: dict[str, Any] = defs) -> Any:
            if isinstance(value, dict):
                if "$ref" in value:
                    return resolve(defs[value["$ref"].split("/")[-1]])
                return {k: resolve(v) for k, v in value.items() if k != "title"}
            return [resolve(v) for v in value] if isinstance(value, list) else value

        result.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": description,
                    "parameters": resolve(raw),
                },
            }
        )
    return result
