"""Dataset determinista compartido por SQL, Spring Boot y Postman."""

import uuid
from dataclasses import dataclass, field
from typing import Any

from app.core.canonical_model.model import UMLModel

from .data_profile import DataProfile
from .domain_analyzer import DomainType
from .entity_info import EntityInfo
from .exceptions import GenerationError
from .sql_values import constrained_value, identifier, literal


@dataclass
class LogicalDataset:
    sql_statements: list[str] = field(default_factory=list)
    entity_records: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    postman_defaults: dict[str, str] = field(default_factory=dict)


class SyntheticDataGenerator:
    @classmethod
    def generate(
        cls,
        model: UMLModel,
        ordered_entities: list[EntityInfo],
        domain: DomainType,
        rows_per_entity: int = 3,
    ) -> LogicalDataset:
        if not 1 <= rows_per_entity <= 1000:
            raise GenerationError("La cantidad debe estar entre 1 y 1.000 registros.")
        dataset = LogicalDataset()
        by_name = {e.class_name: e for e in ordered_entities}
        generated_ids: dict[str, list[Any]] = {}

        def ids_for(entity: EntityInfo) -> list[Any]:
            if entity.class_name in generated_ids:
                return generated_ids[entity.class_name]
            if entity.parent_class:
                ids = ids_for(by_name[entity.parent_class])
            elif entity.id_field.java_type == "UUID":
                ids = [
                    str(
                        uuid.uuid5(
                            uuid.NAMESPACE_DNS,
                            f"{model.id}:{entity.class_name}:{i + 1}",
                        )
                    )
                    for i in range(rows_per_entity)
                ]
            elif entity.id_field.java_type in ("Long", "Integer", "Short", "Byte"):
                start = int(constrained_value(entity.id_field, "1"))
                ids = list(range(start, start + rows_per_entity))
                for value in ids:
                    if constrained_value(entity.id_field, str(value)) != str(value):
                        raise GenerationError(
                            f"No caben {rows_per_entity} claves en {entity.class_name}."
                        )
            elif entity.id_field.java_type == "String":
                ids = [
                    constrained_value(entity.id_field, literal(f"id-{i + 1}"))[
                        1:-1
                    ].replace("''", "'")
                    for i in range(rows_per_entity)
                ]
                if len(set(ids)) != rows_per_entity:
                    raise GenerationError(
                        f"No se pueden generar claves únicas en {entity.class_name} con esa longitud."
                    )
            else:
                raise GenerationError(
                    f"Tipo de clave no soportado en {entity.class_name}."
                )
            generated_ids[entity.class_name] = ids
            return ids

        for entity in ordered_entities:
            ids = ids_for(entity)
            name = entity.class_name
            dataset.postman_defaults[name[0].lower() + name[1:] + "Id"] = str(ids[0])

        pending: list[str] = []
        inserted: set[str] = set()
        for entity in ordered_entities:
            name = entity.class_name
            table = identifier(entity.table_name)
            pk = identifier(entity.id_field.name)
            records: list[dict[str, Any]] = []
            for i, record_id in enumerate(generated_ids[name]):
                row: dict[str, Any] = {entity.id_field.name: literal(record_id)}
                for f in entity.fields:
                    row[f.name] = DataProfile.resolve_sql_deterministic_value(
                        f, name, domain, i
                    )
                deferred: dict[str, str] = {}
                for rel in entity.relations:
                    if not rel.persistence_owner or rel.relation_kind not in (
                        "MANY_TO_ONE",
                        "ONE_TO_ONE",
                    ):
                        continue
                    column = rel.join_column or f"{rel.name}_id"
                    target_ids = generated_ids[rel.target_entity]
                    if rel.target_entity == name:
                        if rel.relation_kind == "ONE_TO_ONE" or not rel.is_nullable:
                            value = literal(target_ids[i])
                        else:
                            value = "NULL" if i == 0 else literal(target_ids[0])
                    else:
                        value = literal(target_ids[i])
                    row[column] = value
                    if rel.target_entity not in inserted and rel.target_entity != name:
                        if not rel.is_nullable:
                            raise GenerationError(
                                f"Ciclo obligatorio en {name}.{column}."
                            )
                        deferred[column] = value
                records.append(row.copy())
                insert_row = {
                    k: ("NULL" if k in deferred else v) for k, v in row.items()
                }
                columns = ", ".join(identifier(c) for c in insert_row)
                values = ", ".join(str(v) for v in insert_row.values())
                dataset.sql_statements.append(
                    f"INSERT INTO {table} ({columns}) VALUES ({values}) ON CONFLICT ({pk}) DO NOTHING;"
                )
                if deferred:
                    assignments = ", ".join(
                        f"{identifier(k)} = {v}" for k, v in deferred.items()
                    )
                    pending.append(
                        f"UPDATE {table} SET {assignments} WHERE {pk} = {literal(record_id)};"
                    )
            dataset.entity_records[name] = records
            inserted.add(name)

        dataset.sql_statements.extend(pending)
        for entity in ordered_entities:
            for rel in entity.relations:
                if not rel.persistence_owner or rel.relation_kind != "MANY_TO_MANY":
                    continue
                target = by_name[rel.target_entity]
                table = identifier(f"{entity.table_name}_{target.table_name}")
                owner_col = identifier(f"{entity.class_name.lower()}_id")
                target_col = identifier(f"{target.class_name.lower()}_id")
                # Cada fila participa, aun al pedir más de tres registros.
                pairs = [(i, i) for i in range(rows_per_entity)]
                if rows_per_entity > 1:
                    pairs.append((0, 1))
                for oi, ti in pairs:
                    owner_id = literal(generated_ids[entity.class_name][oi])
                    target_id = literal(generated_ids[target.class_name][ti])
                    dataset.sql_statements.append(
                        f"INSERT INTO {table} ({owner_col}, {target_col}) VALUES ({owner_id}, {target_id}) ON CONFLICT DO NOTHING;"
                    )
        for entity in ordered_entities:
            if (
                entity.id_field.java_type in ("Long", "Integer")
                and not entity.parent_class
            ):
                table = identifier(entity.table_name)
                pk = identifier(entity.id_field.name)
                dataset.sql_statements.append(
                    f"SELECT setval(pg_get_serial_sequence({literal(table.lower())}, {literal(entity.id_field.name.lower())}), GREATEST(coalesce(max({pk}), 1), 1), coalesce(max({pk}), 0) >= 1) FROM {table};"
                )
        return dataset
