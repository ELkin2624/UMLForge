import json
from typing import Any

from app.modules.generator.domain.data_profile import DataProfile
from app.modules.generator.domain.domain_analyzer import DomainType
from app.modules.generator.domain.field_info import FieldInfo

from .resource_mapper import ApiResourceInfo


class RawToken(str):
    """Marcador para valores que no deben llevar comillas en el JSON de Postman (números, booleans, variables numéricas)."""
    pass


def serialize_postman_json(data: dict[str, Any], indent: int = 2) -> str:
    """
    Serializa un diccionario a JSON para Postman respetando tokens crudos
    (sin comillas para variables numéricas o booleanas de Postman como {{$randomInt}} o {{clienteId}}).
    """
    raw_placeholders: dict[str, str] = {}
    counter = 0

    def _replace_tokens(obj: Any) -> Any:
        nonlocal counter
        if isinstance(obj, RawToken):
            token_key = f"__RAW_POSTMAN_TOKEN_{counter}__"
            counter += 1
            raw_placeholders[f'"{token_key}"'] = str(obj)
            return token_key
        elif isinstance(obj, dict):
            return {k: _replace_tokens(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [_replace_tokens(item) for item in obj]
        return obj

    transformed = _replace_tokens(data)
    json_str = json.dumps(transformed, indent=indent, ensure_ascii=False)

    for placeholder, raw_val in raw_placeholders.items():
        json_str = json_str.replace(placeholder, raw_val)

    return json_str


def generate_create_body(
    resource: ApiResourceInfo, domain: DomainType = DomainType.GENERIC
) -> dict[str, Any]:
    body: dict[str, Any] = {}

    for field in resource.create_fields:
        name = field["name"]

        # 1. Campo de relación foránea
        if field.get("is_relation"):
            target_entity = field.get("target_entity", "")
            var_name = target_entity[0].lower() + target_entity[1:] + "Id"
            target_id_type = field.get("target_id_type", "Long")

            var_expr = f"{{{{{var_name}}}}}"
            if field.get("is_collection"):
                # Colección N:M (ej. betaIds: [{{betaId}}])
                if target_id_type == "UUID":
                    body[name] = [var_expr]
                else:
                    body[name] = [RawToken(var_expr)]
            else:
                # Relación 1:1 o N:1 (ej. clienteId: {{clienteId}})
                if target_id_type == "UUID":
                    body[name] = var_expr
                else:
                    body[name] = RawToken(var_expr)
            continue

        # 2. Atributo ordinario
        f_info = FieldInfo(
            name=name,
            java_type=field.get("type", "String"),
            sql_type="VARCHAR(255)",
            is_primary_key=False,
            is_nullable=True,
        )
        expr, is_raw = DataProfile.resolve_postman_expression(
            f_info, resource.entity_name, domain
        )
        if is_raw:
            body[name] = RawToken(expr)
        else:
            body[name] = expr

    return body


def generate_update_body(
    resource: ApiResourceInfo, domain: DomainType = DomainType.GENERIC
) -> dict[str, Any]:
    return generate_create_body(resource, domain)
