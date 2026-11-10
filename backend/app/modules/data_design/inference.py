"""Inferencia de dependencias funcionales (sugerencias) y de problemas de 1FN.

Un diagrama de clases no declara dependencias funcionales; aquí se *proponen*
a partir de la estructura (claves, FKs) y de los nombres. El usuario decide cuáles
acepta. Ninguna sugerencia se usa en el análisis hasta que se acepta.
"""

import re
from dataclasses import dataclass

from app.core.canonical_model.model import UMLModel

from .schemas import LogicalTable

_MULTI_MULT = {"*", "0..*", "1..*"}
_COLLECTION_TYPE = re.compile(r"(\[\]|^(list|set|array|collection|iterable)\b|<)", re.IGNORECASE)

# Nombres que suelen contener varios valores en una sola columna (advertencia, no error).
_LIKELY_MULTIVALUED = {
    "telefonos", "emails", "correos", "direcciones", "idiomas", "etiquetas",
    "tags", "hobbies", "hijos", "categorias",
}
_LIKELY_COMPOSITE = {"direccion", "domicilio", "nombrecompleto"}

_ZIP = {"codigopostal", "cp", "zip", "zipcode", "postalcode"}
_CITY = {"ciudad", "city", "localidad"}
_REGION = {"departamento", "provincia", "estado", "region", "state"}
_COUNTRY = {"pais", "country"}
_BIRTH = {"fechanacimiento", "fechadenacimiento", "birthdate", "birthday"}
_AGE = {"edad", "age"}


@dataclass(frozen=True)
class Suggestion:
    table: str
    lhs: tuple[str, ...]
    rhs: tuple[str, ...]
    rule: str
    reason: str
    confidence: str  # high | medium | low

    @property
    def id(self) -> str:
        return dependency_id(self.table, self.lhs, self.rhs)


def dependency_id(table: str, lhs: tuple[str, ...] | list[str], rhs: tuple[str, ...] | list[str]) -> str:
    return f"{table}:{','.join(sorted(lhs))}->{','.join(sorted(rhs))}"


def _words(name: str) -> list[str]:
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", name).replace("_", " ")
    return [w.lower() for w in spaced.split() if w]


def _norm(name: str) -> str:
    return name.lower().replace("_", "")


def _entity_prefix(column: str, class_names: dict[str, str]) -> str | None:
    """Si ``column`` empieza por el nombre de una clase (ej. clienteNombre), devuelve su tabla."""
    words = _words(column)
    for k in range(1, len(words)):  # deja al menos una palabra como nombre del atributo
        key = "".join(words[:k])
        if key in class_names:
            return class_names[key]
    return None


def infer_dependencies(
    table: LogicalTable, tables: list[LogicalTable]
) -> list[Suggestion]:
    class_names = {
        _norm(t.class_name): t.name for t in tables if t.kind == "entity" and t.class_name
    }
    pk = set(table.primary_key)
    fk_cols = {c for fk in table.foreign_keys for c in fk.columns}
    plain = [c.name for c in table.columns if c.name not in pk and c.name not in fk_cols]

    fk_to: dict[str, list[str]] = {}
    for fk in table.foreign_keys:
        if len(fk.columns) == 1:
            fk_to.setdefault(fk.ref_table, []).append(fk.columns[0])

    out: dict[str, Suggestion] = {}

    def add(s: Suggestion) -> None:
        if not set(s.lhs) & set(s.rhs):
            out.setdefault(s.id, s)

    for col in plain:
        ref_table = _entity_prefix(col, class_names)
        if ref_table is None or ref_table == table.name:
            continue
        # Dependencia transitiva: el atributo pertenece a la entidad que ya se referencia por FK.
        refs = fk_to.get(ref_table, [])
        if len(refs) == 1:
            add(Suggestion(
                table.name, (refs[0],), (col,), "transitive_entity",
                f"«{col}» parece un atributo de la entidad referenciada por {refs[0]} "
                f"({ref_table}); depende de esa clave foránea y no de la clave de {table.name}.",
                "high",
            ))
        # Dependencia parcial: clave compuesta y el atributo depende de solo una parte.
        if len(table.primary_key) > 1:
            part = [
                c for fk in table.foreign_keys if fk.ref_table == ref_table
                for c in fk.columns if c in pk
            ]
            if len(part) == 1:
                add(Suggestion(
                    table.name, (part[0],), (col,), "partial_key",
                    f"«{col}» parece depender solo de {part[0]}, una parte de la clave compuesta.",
                    "high",
                ))

    # Clave natural: ≥2 FKs en una entidad con clave surrogada (permite detectar parciales).
    own_fks = sorted(c for c in fk_cols if c not in pk)
    if table.kind == "entity" and len(own_fks) >= 2 and len(table.primary_key) == 1:
        add(Suggestion(
            table.name, tuple(own_fks), tuple(table.primary_key), "natural_key",
            f"La combinación ({', '.join(own_fks)}) podría identificar de forma única cada "
            f"fila de {table.name} (clave natural). Si es así, los demás atributos se "
            f"analizan contra esa clave.",
            "low",
        ))

    # Grupos conocidos dentro de la misma tabla.
    by_norm = {_norm(c): c for c in plain}

    def link(lhs_set: set[str], rhs_set: set[str], reason: str) -> None:
        for ln, lc in by_norm.items():
            if ln not in lhs_set:
                continue
            for rn, rc in by_norm.items():
                if rn in rhs_set:
                    add(Suggestion(table.name, (lc,), (rc,), "known_group", reason.format(l=lc, r=rc), "low"))

    link(_ZIP, _CITY, "El código postal ({l}) determina la ciudad ({r}).")
    link(_CITY, _REGION | _COUNTRY, "La ciudad ({l}) determina {r}.")
    link(_REGION, _COUNTRY, "{l} determina el país ({r}).")
    link(_BIRTH, _AGE, "{r} se deriva de {l}.")

    return list(out.values())


def first_normal_form_issues(
    model: UMLModel, table_by_class: dict[str, str]
) -> dict[str, list[tuple[str, str, str]]]:
    """Problemas de 1FN por tabla: ``(columna, severidad, mensaje)``.

    ``high``: viola 1FN (multivaluado). ``low``: advertencia por el nombre.
    """
    issues: dict[str, list[tuple[str, str, str]]] = {}
    for cls in model.classes:
        table = table_by_class.get(cls.name)
        if table is None:
            continue
        for attr in cls.attributes:
            norm = _norm(attr.name)
            if attr.multiplicity in _MULTI_MULT or _COLLECTION_TYPE.search(attr.type or ""):
                issues.setdefault(table, []).append((
                    attr.name, "high",
                    (
                        f"«{attr.name}» es multivaluado ({attr.type}, multiplicidad "
                        f"{attr.multiplicity}): guarda varios valores en una celda. Debe "
                        f"moverse a su propia tabla relacionada."
                    ),
                ))
            elif norm in _LIKELY_MULTIVALUED:
                issues.setdefault(table, []).append((
                    attr.name, "low",
                    (
                        f"«{attr.name}» suena a varios valores en una columna; si es así "
                        f"viola 1FN y conviene una tabla aparte."
                    ),
                ))
            elif norm in _LIKELY_COMPOSITE:
                issues.setdefault(table, []).append((
                    attr.name, "low",
                    (
                        f"«{attr.name}» podría ser un atributo compuesto (varias partes en "
                        f"una columna); considera separarlo (calle, número, ciudad…)."
                    ),
                ))
    return issues
