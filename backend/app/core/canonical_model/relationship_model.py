from typing import Any
from pydantic import Field, model_validator
from app.core.uml_core.enums import RelationshipKind

from .element import UMLElement


class UMLRelationship(UMLElement):
    """
    Representa una relación entre dos elementos del modelo (clases, componentes, etc.).
    Utiliza referencias mediante UUIDs/strings para `source` y `target`.
    """

    name: str = Field(default="rel", description="Nombre visible del elemento")
    type: RelationshipKind = Field(
        default=RelationshipKind.ASSOCIATION,
        description="Tipo de relación (asociación, generalización, etc.)",
    )
    source: str = Field(..., description="UUID del elemento origen")
    target: str = Field(..., description="UUID del elemento destino")
    source_multiplicity: str = Field(
        default="1", description="Multiplicidad en el lado origen (si aplica)"
    )
    target_multiplicity: str = Field(
        default="1", description="Multiplicidad en el lado destino (si aplica)"
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_relationship(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normalizar source / source_id
            if "source" not in data and "source_id" in data:
                data["source"] = str(data["source_id"])
            # Normalizar target / target_id
            if "target" not in data and "target_id" in data:
                data["target"] = str(data["target_id"])
            # Normalizar nombre por defecto si falta
            if not data.get("name"):
                src_short = str(data.get("source", ""))[:4]
                data["name"] = f"rel_{src_short}" if src_short else "rel"
            # Normalizar tipo
            if "type" in data and isinstance(data["type"], str):
                t = data["type"].lower()
                if "generalization" in t or "inheritance" in t:
                    data["type"] = "generalization"
                elif "realization" in t:
                    data["type"] = "realization"
                elif "composition" in t:
                    data["type"] = "composition"
                elif "aggregation" in t:
                    data["type"] = "aggregation"
                elif "dependency" in t:
                    data["type"] = "dependency"
                else:
                    data["type"] = "association"
        return data
