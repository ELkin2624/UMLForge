from typing import Any

from .resource_mapper import ApiResourceInfo


def get_dummy_value_for_type(type_name: str) -> Any:
    t = type_name.lower()
    if t in ("string", "str"):
        return "string"
    if t in ("integer", "int", "long", "bigint"):
        return 1
    if t in ("double", "float", "bigdecimal"):
        return 1.0
    if t in ("boolean", "bool"):
        return True
    if t in ("date", "datetime", "localdatetime"):
        return "2025-01-01T00:00:00"
    return "string"


def generate_create_body(resource: ApiResourceInfo) -> dict[str, Any]:
    body = {}
    for field in resource.create_fields:
        body[field["name"]] = get_dummy_value_for_type(field["type"])
    return body


def generate_update_body(resource: ApiResourceInfo) -> dict[str, Any]:
    body = {}
    for field in resource.update_fields:
        body[field["name"]] = get_dummy_value_for_type(field["type"])
    return body
