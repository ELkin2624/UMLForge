"""Literales e identificadores PostgreSQL compartidos por las salidas SQL."""

import hashlib
import math
import re
from datetime import date, datetime
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal, InvalidOperation

from .exceptions import GenerationError
from .field_info import FieldInfo

_RESERVED = frozenset(
    [
        "all",
        "analyse",
        "analyze",
        "and",
        "any",
        "array",
        "as",
        "asc",
        "asymmetric",
        "authorization",
        "binary",
        "both",
        "case",
        "cast",
        "check",
        "collate",
        "collation",
        "column",
        "concurrently",
        "constraint",
        "create",
        "cross",
        "current_catalog",
        "current_date",
        "current_role",
        "current_schema",
        "current_time",
        "current_timestamp",
        "current_user",
        "default",
        "deferrable",
        "desc",
        "distinct",
        "do",
        "else",
        "end",
        "except",
        "false",
        "fetch",
        "for",
        "foreign",
        "freeze",
        "from",
        "full",
        "grant",
        "group",
        "having",
        "ilike",
        "in",
        "initially",
        "inner",
        "intersect",
        "into",
        "is",
        "isnull",
        "join",
        "lateral",
        "leading",
        "left",
        "like",
        "limit",
        "localtime",
        "localtimestamp",
        "natural",
        "not",
        "notnull",
        "null",
        "offset",
        "on",
        "only",
        "or",
        "order",
        "outer",
        "overlaps",
        "placing",
        "primary",
        "references",
        "returning",
        "right",
        "select",
        "session_user",
        "similar",
        "some",
        "symmetric",
        "table",
        "tablesample",
        "then",
        "to",
        "trailing",
        "true",
        "union",
        "unique",
        "user",
        "using",
        "variadic",
        "verbose",
        "when",
        "where",
        "window",
        "with",
    ]
)


def identifier(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value) or len(value.encode()) > 63:
        raise GenerationError(f"Identificador SQL inválido: {value!r}")
    return f'"{value.lower()}"' if value.lower() in _RESERVED else value


def literal(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, Decimal)):
        return str(value)
    text = str(value)
    if "\x00" in text:
        raise GenerationError("Un literal SQL no puede contener caracteres nulos.")
    return "'" + text.replace("'", "''") + "'"


def constraint_sql(value: str) -> str:
    """Escapa solo los identificadores de las restricciones generadas internamente."""

    def columns(match: re.Match[str]) -> str:
        return "(" + ", ".join(identifier(c.strip()) for c in match[1].split(",")) + ")"

    value = re.sub(r"\(([^)]+)\)", columns, value)
    return re.sub(
        r"REFERENCES ([A-Za-z_][A-Za-z0-9_]*)",
        lambda m: "REFERENCES " + identifier(m[1]),
        value,
    )


def validate_field(field: FieldInfo) -> None:
    numeric = {"Byte", "Short", "Integer", "Long", "Float", "Double", "BigDecimal"}
    if field.min_value is not None or field.max_value is not None:
        if field.java_type not in numeric:
            raise GenerationError(
                f"Los límites numéricos no corresponden a {field.name}."
            )
        if any(
            v is not None and not math.isfinite(v)
            for v in (field.min_value, field.max_value)
        ):
            raise GenerationError(f"Límite numérico inválido en {field.name}.")
        if (
            field.min_value is not None
            and field.max_value is not None
            and field.min_value > field.max_value
        ):
            raise GenerationError(f"Límites incompatibles en {field.name}.")
    if field.min_length is not None or field.max_length is not None:
        if field.java_type != "String":
            raise GenerationError(
                f"Los límites de longitud no corresponden a {field.name}."
            )
        minimum = field.min_length or 0
        maximum = field.max_length
        match = re.fullmatch(r"VARCHAR\((\d+)\)", field.sql_type, re.IGNORECASE)
        if match:
            maximum = (
                min(maximum, int(match[1])) if maximum is not None else int(match[1])
            )
        if minimum < 0 or (maximum is not None and (maximum < 0 or minimum > maximum)):
            raise GenerationError(f"Longitudes incompatibles en {field.name}.")


def constrained_value(field: FieldInfo, candidate: str) -> str:
    """Ajusta el valor sugerido al tipo y límites declarados, antes de escaparlo."""
    validate_field(field)
    kind = field.java_type
    numeric = {
        "Byte": (-32768, 32767),
        "Short": (-32768, 32767),
        "Integer": (-2147483648, 2147483647),
        "Long": (-9223372036854775808, 9223372036854775807),
    }
    if kind in numeric or kind in ("Float", "Double", "BigDecimal"):
        lower = Decimal(str(field.min_value)) if field.min_value is not None else None
        upper = Decimal(str(field.max_value)) if field.max_value is not None else None
        try:
            value = Decimal(candidate.strip("'"))
        except InvalidOperation:
            value = Decimal(1)
        if kind in ("Float", "Double"):
            type_limit = Decimal(
                "3.4028234e38" if kind == "Float" else "1.7976931348623157e308"
            )
            lower = max(-type_limit, lower) if lower is not None else -type_limit
            upper = min(type_limit, upper) if upper is not None else type_limit
        if kind in numeric:
            lo, hi = numeric[kind]
            lower = max(Decimal(lo), lower if lower is not None else Decimal(lo))
            upper = min(Decimal(hi), upper if upper is not None else Decimal(hi))
            lower = lower.to_integral_value(rounding=ROUND_CEILING)
            upper = upper.to_integral_value(rounding=ROUND_FLOOR)
            value = value.to_integral_value()
        elif kind == "BigDecimal":
            # El mapper utiliza NUMERIC(19,4).
            lower = (
                max(Decimal("-999999999999999.9999"), lower)
                if lower is not None
                else Decimal("-999999999999999.9999")
            )
            upper = (
                min(Decimal("999999999999999.9999"), upper)
                if upper is not None
                else Decimal("999999999999999.9999")
            )
            if lower > upper:
                raise GenerationError(f"Límites incompatibles en {field.name}.")
            lower = lower.quantize(Decimal(".0001"), rounding=ROUND_CEILING)
            upper = upper.quantize(Decimal(".0001"), rounding=ROUND_FLOOR)
            value = value.quantize(Decimal(".0001"))
        if any(v is not None and not v.is_finite() for v in (lower, upper, value)):
            raise GenerationError(f"Límite numérico inválido en {field.name}.")
        if lower is not None and upper is not None and lower > upper:
            raise GenerationError(f"Límites incompatibles en {field.name}.")
        if lower is not None:
            value = max(lower, value)
        if upper is not None:
            value = min(upper, value)
        return literal(value)
    if kind == "Boolean":
        return "true" if candidate == "true" else "false"
    if kind == "LocalTime":
        return literal("10:30:00")
    if kind == "byte[]":
        return "decode('554d4c', 'hex')"
    value = (
        candidate[1:-1]
        if candidate.startswith("'") and candidate.endswith("'")
        else candidate
    )
    if kind in ("LocalDate", "Date", "LocalDateTime", "Instant"):
        # La heurística por nombre no debe convertir un timestamp en otro tipo.
        if kind in ("LocalDateTime", "Instant") and len(value) == 10:
            value += " 10:30:00"
        try:
            (
                date.fromisoformat(value)
                if kind in ("LocalDate", "Date")
                else datetime.fromisoformat(value)
            )
        except ValueError as exc:
            raise GenerationError(f"Fecha inválida en {field.name}.") from exc
        return literal(value)
    minimum = field.min_length if field.min_length is not None else 0
    maximum = field.max_length
    match = re.fullmatch(r"VARCHAR\((\d+)\)", field.sql_type, re.IGNORECASE)
    if match:
        maximum = min(maximum, int(match[1])) if maximum is not None else int(match[1])
    if minimum < 0 or (maximum is not None and (maximum < 0 or minimum > maximum)):
        raise GenerationError(f"Longitudes incompatibles en {field.name}.")
    if maximum is not None:
        value = value[:maximum]
    return literal(value.ljust(minimum, "x"))


def add_foreign_key(constraint: str, table: str) -> str:
    """Añade FK sin duplicarla al reiniciar Spring (ScriptUtils respeta comillas simples)."""
    table_sql = identifier(table)
    name = "fk_" + hashlib.sha256(f"{table}:{constraint}".encode()).hexdigest()[:24]
    body = (
        "BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint "
        f"WHERE conrelid = {literal(table_sql.lower())}::regclass "
        f"AND conname = {literal(name)}) THEN "
        f"ALTER TABLE {table_sql} ADD CONSTRAINT {name} {constraint_sql(constraint)}; "
        "END IF; END"
    )
    return "DO " + literal(body) + ";"
