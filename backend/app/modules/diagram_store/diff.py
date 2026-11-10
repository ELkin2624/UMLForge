"""Diferencias entre dos versiones de un modelo UML (JSON canónico).

Función pura: no depende de la base de datos. Compara listas de elementos por
``id`` y, dentro de cada elemento, listas anidadas (atributos, operaciones...).
"""

from typing import Any

# Etiqueta legible (singular) por clave de lista.
KIND_LABELS: dict[str, str] = {
    "classes": "clase",
    "attributes": "atributo",
    "operations": "método",
    "methods": "método",
    "relationships": "relación",
    "associations": "asociación",
    "generalizations": "generalización",
    "realizations": "realización",
    "dependencies": "dependencia",
    "interfaces": "interfaz",
    "packages": "paquete",
    "components": "componente",
    "ports": "puerto",
    "connectors": "conector",
}

# Campos que no cuentan como "modificación" del elemento (son estructura anidada).
_IGNORED_SCALARS = {"id"}


def _is_element_list(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) > 0
        and all(isinstance(v, dict) and "id" in v for v in value)
    )


def _scalar_fields(element: dict[str, Any]) -> dict[str, Any]:
    return {
        k: v
        for k, v in element.items()
        if k not in _IGNORED_SCALARS
        and not _is_element_list(v)
        and not (k in KIND_LABELS and isinstance(v, list))
    }


def _change(
    op: str, kind: str, element: dict[str, Any], detail: str | None = None,
    parent: str | None = None,
) -> dict[str, Any]:
    return {
        "op": op,
        "kind": kind,
        "id": str(element.get("id")),
        "name": str(element.get("name") or element.get("id")),
        "parent": parent,
        "detail": detail,
    }


def _diff_lists(
    key: str,
    old_items: list[dict[str, Any]],
    new_items: list[dict[str, Any]],
    parent: str | None,
    out: list[dict[str, Any]],
) -> None:
    kind = KIND_LABELS.get(key, key)
    old_by_id = {str(i["id"]): i for i in old_items if isinstance(i, dict) and "id" in i}
    new_by_id = {str(i["id"]): i for i in new_items if isinstance(i, dict) and "id" in i}

    for item_id, item in new_by_id.items():
        if item_id not in old_by_id:
            out.append(_change("added", kind, item, parent=parent))
    for item_id, item in old_by_id.items():
        if item_id not in new_by_id:
            out.append(_change("removed", kind, item, parent=parent))

    for item_id, new_item in new_by_id.items():
        old_item = old_by_id.get(item_id)
        if old_item is None:
            continue
        old_fields, new_fields = _scalar_fields(old_item), _scalar_fields(new_item)
        changed = sorted(
            k for k in set(old_fields) | set(new_fields)
            if old_fields.get(k) != new_fields.get(k)
        )
        if changed:
            detail = ", ".join(
                f"{k}: {old_fields.get(k)!r} -> {new_fields.get(k)!r}" for k in changed
            )
            out.append(_change("modified", kind, new_item, detail=detail, parent=parent))

        # Listas anidadas (atributos, operaciones, ...)
        nested_keys = {
            k for k in set(old_item) | set(new_item)
            if _is_element_list(old_item.get(k))
            or _is_element_list(new_item.get(k))
            or (k in KIND_LABELS and isinstance(new_item.get(k), list))
        }
        for nested in sorted(nested_keys):
            _diff_lists(
                nested,
                old_item.get(nested) or [],
                new_item.get(nested) or [],
                parent=str(new_item.get("name") or item_id),
                out=out,
            )


def diff_models(old: dict[str, Any] | None, new: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Devuelve la lista de cambios entre ``old`` y ``new``.

    Cada cambio: ``{op, kind, id, name, parent, detail}``. Lista vacía = sin cambios.
    """
    old = old or {}
    new = new or {}
    out: list[dict[str, Any]] = []

    for key in sorted(set(old) | set(new)):
        o, n = old.get(key), new.get(key)
        if _is_element_list(o) or _is_element_list(n) or (
            isinstance(o, list) and isinstance(n, list) and key in KIND_LABELS
        ):
            _diff_lists(
                key,
                [i for i in (o or []) if isinstance(i, dict)],
                [i for i in (n or []) if isinstance(i, dict)],
                parent=None,
                out=out,
            )
        elif key == "visual_state" and o != n:
            old_positions, new_positions = o or {}, n or {}
            moved = sum(
                old_positions.get(node_id) != new_positions.get(node_id)
                for node_id in old_positions.keys() | new_positions.keys()
            )
            out.append({
                "op": "modified", "kind": "lienzo", "id": key,
                "name": "posiciones", "parent": None,
                "detail": f"Cambió la posición de {moved} elemento(s)",
            })
        elif o != n and key not in _IGNORED_SCALARS:
            out.append({
                "op": "modified", "kind": "modelo", "id": key, "name": key,
                "parent": None, "detail": f"{o!r} -> {n!r}",
            })
    return out


def summarize(changes: list[dict[str, Any]], max_items: int = 4) -> str:
    """Resumen corto en español, ej. 'Agregó clase Cliente; modificó atributo Venta.total'."""
    if not changes:
        return "Sin cambios"
    verbs = {"added": "Agregó", "removed": "Eliminó", "modified": "Modificó"}
    parts: list[str] = []
    for c in changes[:max_items]:
        target = f"{c['parent']}.{c['name']}" if c.get("parent") else c["name"]
        parts.append(f"{verbs[c['op']].lower()} {c['kind']} {target}")
    text = "; ".join(parts)
    text = text[0].upper() + text[1:]
    extra = len(changes) - max_items
    if extra > 0:
        text += f" y {extra} cambio{'s' if extra > 1 else ''} más"
    return text
