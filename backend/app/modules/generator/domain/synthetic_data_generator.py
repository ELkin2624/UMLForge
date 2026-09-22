import uuid
from dataclasses import dataclass, field
from typing import Any

from app.core.canonical_model.model import UMLModel

from .data_profile import DataProfile
from .domain_analyzer import DomainType
from .entity_info import EntityInfo


@dataclass
class LogicalDataset:
    sql_statements: list[str] = field(default_factory=list)
    entity_records: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    postman_defaults: dict[str, str] = field(default_factory=dict)


class SyntheticDataGenerator:
    """
    Genera un dataset lógico unificado, determinista y coherente en memoria.
    Garantiza que data.sql y Postman compartan exactamente los mismos IDs y referencias foráneas.
    """

    @classmethod
    def generate(
        cls,
        model: UMLModel,
        ordered_entities: list[EntityInfo],
        domain: DomainType,
        rows_per_entity: int = 3,
    ) -> LogicalDataset:
        dataset = LogicalDataset()
        generated_ids: dict[str, list[Any]] = {}

        # 1. Asignar IDs lógicos deterministas por entidad
        for entity in ordered_entities:
            c_name = entity.class_name
            id_type = entity.id_field.java_type
            ids: list[Any] = []

            for i in range(rows_per_entity):
                if id_type == "UUID":
                    deterministic_uuid = str(
                        uuid.uuid5(uuid.NAMESPACE_DNS, f"{model.id}:{c_name}:{i + 1}")
                    )
                    ids.append(deterministic_uuid)
                else:
                    ids.append(i + 1)

            generated_ids[c_name] = ids
            # Variable por defecto para Postman (ej. clienteId -> 1 o UUID)
            var_name = c_name[0].lower() + c_name[1:] + "Id"
            dataset.postman_defaults[var_name] = str(ids[0]) if ids else "1"

        # 2. Generar registros y sentencias SQL para cada entidad
        for entity in ordered_entities:
            c_name = entity.class_name
            t_name = entity.table_name
            id_type = entity.id_field.java_type
            records: list[dict[str, Any]] = []

            for i in range(rows_per_entity):
                record_id = generated_ids[c_name][i]
                id_sql_val = f"'{record_id}'" if id_type == "UUID" else record_id
                row: dict[str, Any] = {entity.id_field.name: id_sql_val}

                # Columnas básicas
                for f in entity.fields:
                    val = DataProfile.resolve_sql_deterministic_value(f, c_name, domain, i)
                    row[f.name] = val

                # Claves foráneas para relaciones ManyToOne / OneToOne (owner)
                for rel in entity.relations:
                    if rel.persistence_owner and rel.relation_kind in ("MANY_TO_ONE", "ONE_TO_ONE"):
                        join_col = rel.join_column or f"{rel.name}_id"
                        # Si es auto-referencia (ej. Categoria -> Categoria):
                        # La primera fila (raíz) no tiene padre (NULL).
                        # Las filas siguientes tienen como categoría padre a la raíz (target_ids[0]).
                        if rel.target_entity == c_name:
                            target_ids = generated_ids.get(c_name, [])
                            if i == 0 or not target_ids:
                                row[join_col] = "NULL"
                            else:
                                root_id = target_ids[0]
                                row[join_col] = f"'{root_id}'" if rel.target_id_type == "UUID" else str(root_id)
                            continue

                        target_ids = generated_ids.get(rel.target_entity, [])
                        if target_ids:
                            target_id = target_ids[i % len(target_ids)]
                            if rel.target_id_type == "UUID":
                                row[join_col] = f"'{target_id}'"
                            else:
                                row[join_col] = str(target_id)


                records.append(row)

                # Construir INSERT SQL
                cols = list(row.keys())
                vals = [str(row[c]) for c in cols]
                cols_str = ", ".join(cols)
                vals_str = ", ".join(vals)
                dataset.sql_statements.append(
                    f"INSERT INTO {t_name} ({cols_str}) VALUES ({vals_str}) ON CONFLICT ({entity.id_field.name}) DO NOTHING;"
                )

            dataset.entity_records[c_name] = records

            # Para tablas con secuencias en PostgreSQL, sincronizar el contador de secuencia
            if id_type in ("Long", "Integer"):
                dataset.sql_statements.append(
                    f"SELECT setval(pg_get_serial_sequence('{t_name.lower()}', '{entity.id_field.name.lower()}'), coalesce(max({entity.id_field.name}), 1)) FROM {t_name};"
                )

        # 3. Generar inserciones para tablas intermedias MANY_TO_MANY
        for entity in ordered_entities:
            for rel in entity.relations:
                if rel.persistence_owner and rel.relation_kind == "MANY_TO_MANY":
                    owner_target = next((e for e in ordered_entities if e.class_name == rel.target_entity), None)
                    target_table = owner_target.table_name if owner_target else f"{rel.target_entity.lower()}s"
                    join_table = f"{entity.table_name}_{target_table}"

                    col_owner = f"{entity.class_name.lower()}_id"
                    col_target = f"{rel.target_entity.lower()}_id"

                    owner_ids = generated_ids.get(entity.class_name, [])
                    target_ids = generated_ids.get(rel.target_entity, [])

                    if owner_ids and target_ids:
                        pairs = [
                            (owner_ids[0], target_ids[0]),
                            (owner_ids[0], target_ids[1 % len(target_ids)]),
                            (owner_ids[1 % len(owner_ids)], target_ids[1 % len(target_ids)]),
                            (owner_ids[2 % len(owner_ids)], target_ids[0]),
                        ]
                        for o_id, t_id in pairs:
                            o_str = f"'{o_id}'" if entity.id_field.java_type == "UUID" else str(o_id)
                            t_str = f"'{t_id}'" if (owner_target and owner_target.id_field.java_type == "UUID") else str(t_id)
                            dataset.sql_statements.append(
                                f"INSERT INTO {join_table} ({col_owner}, {col_target}) VALUES ({o_str}, {t_str}) ON CONFLICT DO NOTHING;"
                            )

        return dataset
