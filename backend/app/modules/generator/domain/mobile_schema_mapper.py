from pydantic import BaseModel, Field
from typing import Any

from .entity_info import EntityInfo


class MobileFieldConfig(BaseModel):
    name: str
    label: str
    ui_type: str  # text, number, date, datetime, boolean, email, phone, currency
    required: bool
    is_primary_key: bool = False
    is_list_visible: bool = True
    is_searchable: bool = False
    min_length: int | None = None
    max_length: int | None = None
    min_value: float | None = None
    max_value: float | None = None


class MobileRelationConfig(BaseModel):
    name: str
    target_entity: str
    relation_kind: str
    join_column: str | None = None
    is_collection: bool = False


class MobileEntityConfig(BaseModel):
    name: str
    plural_name: str
    table_name: str
    resource_path: str
    icon: str
    id_field_name: str
    fields: list[MobileFieldConfig] = Field(default_factory=list)
    relations: list[MobileRelationConfig] = Field(default_factory=list)


class MobileSchemaInfo(BaseModel):
    schema_version: str = "1.0"
    project_name: str
    domain: str
    entities: list[MobileEntityConfig] = Field(default_factory=list)


class MobileSchemaMapper:
    @classmethod
    def map_schema(
        cls, project_name: str, entities: list[EntityInfo], domain: str = "general"
    ) -> MobileSchemaInfo:
        schema = MobileSchemaInfo(
            schema_version="1.0",
            project_name=project_name,
            domain=domain,
        )

        for entity in entities:
            fields: list[MobileFieldConfig] = []

            # Campo ID
            fields.append(
                MobileFieldConfig(
                    name=entity.id_field.name,
                    label="ID",
                    ui_type="number" if entity.id_field.java_type in ("Long", "Integer", "int", "long") else "text",
                    required=True,
                    is_primary_key=True,
                    is_list_visible=True,
                    is_searchable=True,
                )
            )

            # Demás campos
            for idx, f in enumerate(entity.fields):
                ui_type = cls._infer_ui_type(f.name, f.java_type)
                # Visible en lista por defecto los primeros 3 campos
                is_visible = idx < 3
                is_search = ui_type in ("text", "email", "phone")

                fields.append(
                    MobileFieldConfig(
                        name=f.name,
                        label=cls._format_label(f.name),
                        ui_type=ui_type,
                        required=not f.is_nullable,
                        is_primary_key=False,
                        is_list_visible=is_visible,
                        is_searchable=is_search,
                        min_length=f.min_length,
                        max_length=f.max_length,
                        min_value=f.min_value,
                        max_value=f.max_value,
                    )
                )

            # Relaciones
            relations: list[MobileRelationConfig] = []
            for rel in entity.relations:
                relations.append(
                    MobileRelationConfig(
                        name=rel.name,
                        target_entity=rel.target_entity,
                        relation_kind=rel.relation_kind,
                        join_column=rel.join_column,
                        is_collection=rel.is_collection,
                    )
                )

            resource_path = entity.resource_path if entity.resource_path else f"/api/{entity.table_name}"
            if not resource_path.startswith("/"):
                resource_path = f"/{resource_path}"

            schema.entities.append(
                MobileEntityConfig(
                    name=entity.class_name,
                    plural_name=f"{entity.class_name}s",
                    table_name=entity.table_name,
                    resource_path=resource_path,
                    icon=cls._infer_icon(entity.class_name),
                    id_field_name=entity.id_field.name,
                    fields=fields,
                    relations=relations,
                )
            )

        return schema

    @staticmethod
    def _format_label(name: str) -> str:
        words = name.replace("_", " ")
        import re
        s = re.sub(r"([A-Z])", r" \1", words).strip()
        return s.title()

    @staticmethod
    def _infer_ui_type(field_name: str, java_type: str) -> str:
        fn_lower = field_name.lower()
        if "email" in fn_lower:
            return "email"
        if "telefono" in fn_lower or "phone" in fn_lower or "celular" in fn_lower:
            return "phone"
        if "precio" in fn_lower or "costo" in fn_lower or "price" in fn_lower or "total" in fn_lower or "monto" in fn_lower:
            return "currency"
        if "fecha" in fn_lower or "date" in fn_lower:
            if "hora" in fn_lower or "time" in fn_lower:
                return "datetime"
            return "date"
        if "hora" in fn_lower or "time" in fn_lower:
            return "datetime"
        if java_type in ("Boolean", "boolean"):
            return "boolean"
        if java_type in ("Integer", "int", "Long", "long", "Double", "double", "Float", "float", "BigDecimal"):
            return "number"
        return "text"

    @staticmethod
    def _infer_icon(class_name: str) -> str:
        cn_lower = class_name.lower()
        if any(w in cn_lower for w in ("cliente", "user", "usuario", "persona", "barbero", "empleado")):
            return "user"
        if any(w in cn_lower for w in ("corte", "servicio", "item", "producto", "articulo")):
            return "scissors" if "corte" in cn_lower else "tag"
        if any(w in cn_lower for w in ("cita", "reserva", "turno", "appointment")):
            return "calendar"
        if any(w in cn_lower for w in ("pago", "factura", "transaccion", "venta", "order")):
            return "dollar-sign"
        return "folder"
