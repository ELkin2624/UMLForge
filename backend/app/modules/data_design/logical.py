"""Del modelo conceptual (clases UML) al modelo lógico relacional.

Reutiliza los mappers del generador (``EntityMapper`` + ``SchemaMapper``), de modo
que el modelo lógico mostrado es exactamente el que genera el backend Spring Boot.
"""

import re

from app.core.canonical_model.model import UMLModel
from app.modules.generator.domain.entity_info import EntityInfo
from app.modules.generator.domain.entity_mapper import EntityMapper
from app.modules.generator.domain.schema_mapper import SchemaMapper, TableInfo

from .schemas import (
    LogicalColumn,
    LogicalEdge,
    LogicalForeignKey,
    LogicalModel,
    LogicalTable,
    MappingRule,
)

_FK_RE = re.compile(
    r"FOREIGN KEY \((?P<cols>[^)]+)\) REFERENCES (?P<table>\w+)\((?P<refs>[^)]+)\)"
    r"(?P<cascade> ON DELETE CASCADE)?",
    re.IGNORECASE,
)
_PK_RE = re.compile(r"PRIMARY KEY \((?P<cols>[^)]+)\)", re.IGNORECASE)


def _split(cols: str) -> list[str]:
    return [c.strip() for c in cols.split(",") if c.strip()]


def _sql_type(sql_type: str, is_pk: bool) -> str:
    """Tipo lógico: SERIAL/BIGSERIAL son autoincrementales sobre INTEGER/BIGINT."""
    return {"SERIAL": "INTEGER", "BIGSERIAL": "BIGINT"}.get(sql_type.upper(), sql_type)


def _build_table(
    info: TableInfo, entity: EntityInfo | None, entity_tables: dict[str, EntityInfo]
) -> LogicalTable:
    foreign_keys: list[LogicalForeignKey] = []
    pk_cols = [c.name for c in info.columns if c.is_primary_key]

    for raw in info.foreign_keys:
        pk_match = _PK_RE.match(raw)
        if pk_match:
            pk_cols = _split(pk_match.group("cols"))
            continue
        fk_match = _FK_RE.match(raw)
        if fk_match:
            foreign_keys.append(LogicalForeignKey(
                columns=_split(fk_match.group("cols")),
                ref_table=fk_match.group("table"),
                ref_columns=_split(fk_match.group("refs")),
                on_delete="CASCADE" if fk_match.group("cascade") else None,
            ))

    fk_ref: dict[str, str] = {}
    for fk in foreign_keys:
        for col, ref in zip(fk.columns, fk.ref_columns, strict=False):
            fk_ref[col] = f"{fk.ref_table}.{ref}"

    columns = [
        LogicalColumn(
            name=c.name,
            sql_type=_sql_type(c.sql_type, c.is_primary_key),
            is_pk=c.name in pk_cols,
            is_fk=c.name in fk_ref,
            nullable=c.is_nullable and c.name not in pk_cols,
            references=fk_ref.get(c.name),
        )
        for c in info.columns
    ]

    notes: list[str] = []
    kind = "entity" if entity is not None else "join"
    if kind == "join":
        a, b = (fk.ref_table for fk in foreign_keys[:2]) if len(foreign_keys) >= 2 else ("?", "?")
        notes.append(f"Tabla intermedia por la relación N:M entre {a} y {b}; clave compuesta.")
    if entity is not None and entity.parent_class:
        parent = next(
            (e for e in entity_tables.values() if e.class_name == entity.parent_class), None
        )
        notes.append(
            f"Herencia (tabla por subclase): la clave primaria es también FK hacia "
            f"{parent.table_name if parent else entity.parent_class}."
        )

    return LogicalTable(
        name=info.name,
        class_name=entity.class_name if entity else None,
        kind=kind,
        columns=columns,
        primary_key=pk_cols,
        foreign_keys=foreign_keys,
        notes=notes,
    )


def _mappings(entities: list[EntityInfo]) -> list[MappingRule]:
    rules: list[MappingRule] = []
    for e in entities:
        rules.append(MappingRule(
            element=e.class_name, kind="class", result=f"tabla {e.table_name}",
            rule="Cada clase es candidata a tabla; sus atributos son columnas y su "
                 "identificador, la clave primaria.",
        ))
        if e.parent_class:
            rules.append(MappingRule(
                element=f"{e.class_name} hereda de {e.parent_class}", kind="inheritance",
                result=f"PK de {e.table_name} = FK hacia la tabla de {e.parent_class}",
                rule="Generalización: una tabla por clase; la subclase comparte la clave "
                     "de su superclase.",
            ))
        for rel in e.relations:
            if not rel.persistence_owner:
                continue
            if rel.relation_kind == "MANY_TO_MANY":
                rules.append(MappingRule(
                    element=f"{e.class_name} ↔ {rel.target_entity} (N:M)",
                    kind="relationship",
                    result=f"tabla intermedia {e.table_name}_{(rel.target_table or rel.target_entity.lower())}",
                    rule="Una relación muchos-a-muchos se resuelve con una tabla "
                         "intermedia de clave compuesta.",
                ))
            elif rel.join_column:
                label = {"MANY_TO_ONE": "N:1", "ONE_TO_ONE": "1:1"}.get(rel.relation_kind, rel.relation_kind)
                rules.append(MappingRule(
                    element=f"{e.class_name} → {rel.target_entity} ({label})",
                    kind="relationship",
                    result=f"columna {rel.join_column} (FK) en {e.table_name}",
                    rule="La clave foránea vive en el lado 'muchos' de la relación "
                         "(o en el lado propietario si es 1:1).",
                ))
    return rules


def build_logical_model(model: UMLModel) -> tuple[LogicalModel, list[EntityInfo]]:
    """Construye el modelo lógico. Devuelve también las entidades (las usa la inferencia)."""
    entities = EntityMapper.map_entities(model)
    schema = SchemaMapper.map_schema(entities)
    by_table = {e.table_name: e for e in entities}

    tables = [_build_table(t, by_table.get(t.name), by_table) for t in schema.tables]

    # Aristas del diagrama: una por FK. Cardinalidad 1:1 si la relación JPA lo es.
    one_to_one: set[tuple[str, str]] = set()
    for e in entities:
        for rel in e.relations:
            if rel.persistence_owner and rel.relation_kind == "ONE_TO_ONE" and rel.join_column:
                one_to_one.add((e.table_name, rel.join_column))

    edges: list[LogicalEdge] = []
    for table in tables:
        for fk in table.foreign_keys:
            is_1to1 = (table.name, fk.columns[0]) in one_to_one or (
                table.kind == "entity" and fk.columns == table.primary_key
            )
            edges.append(LogicalEdge(
                id=f"{table.name}.{'_'.join(fk.columns)}->{fk.ref_table}",
                from_table=table.name,
                to_table=fk.ref_table,
                columns=fk.columns,
                cardinality="1:1" if is_1to1 else "N:1",
                label=", ".join(fk.columns),
            ))

    return LogicalModel(tables=tables, edges=edges, mappings=_mappings(entities)), entities
