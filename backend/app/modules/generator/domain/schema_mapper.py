from pydantic import BaseModel, Field

from .entity_info import EntityInfo


class ColumnInfo(BaseModel):
    name: str
    sql_type: str
    is_primary_key: bool
    is_nullable: bool


class TableInfo(BaseModel):
    name: str
    columns: list[ColumnInfo] = Field(default_factory=list)
    foreign_keys: list[str] = Field(default_factory=list)


class SchemaInfo(BaseModel):
    tables: list[TableInfo] = Field(default_factory=list)


class SchemaMapper:
    @classmethod
    def map_schema(cls, entities: list[EntityInfo]) -> SchemaInfo:
        schema = SchemaInfo()
        entity_by_name = {e.class_name: e for e in entities}
        join_tables: list[TableInfo] = []

        for entity in entities:
            table = TableInfo(name=entity.table_name)

            # Primary Key
            sql_type = entity.id_field.sql_type
            if sql_type in ("BIGINT", "Long", "INTEGER", "INT"):
                sql_type = "BIGSERIAL" if sql_type in ("BIGINT", "Long") else "SERIAL"

            table.columns.append(
                ColumnInfo(
                    name=entity.id_field.name,
                    sql_type=sql_type,
                    is_primary_key=True,
                    is_nullable=False,
                )
            )

            # Si hereda (JOINED), su PK es también FK hacia la tabla padre
            if entity.parent_class and entity.parent_class in entity_by_name:
                parent_ent = entity_by_name[entity.parent_class]
                table.foreign_keys.append(
                    f"FOREIGN KEY ({entity.id_field.name}) REFERENCES {parent_ent.table_name}({parent_ent.id_field.name}) ON DELETE CASCADE"
                )

            # Atributos ordinarios
            for f in entity.fields:
                table.columns.append(
                    ColumnInfo(
                        name=f.name,
                        sql_type=f.sql_type,
                        is_primary_key=False,
                        is_nullable=f.is_nullable,
                    )
                )

            # Relaciones
            for rel in entity.relations:
                # Si esta entidad es owner y tiene join_column, agregamos la columna y FK
                if rel.persistence_owner and rel.join_column:
                    target_ent = entity_by_name.get(rel.target_entity)
                    target_pk = target_ent.id_field.name if target_ent else "id"
                    fk_sql_type = "UUID" if rel.target_id_type == "UUID" else "BIGINT"
                    target_table = target_ent.table_name if target_ent else cls._get_table_name(rel.target_entity, entities)

                    table.columns.append(
                        ColumnInfo(
                            name=rel.join_column,
                            sql_type=fk_sql_type,
                            is_primary_key=False,
                            is_nullable=True,
                        )
                    )
                    table.foreign_keys.append(
                        f"FOREIGN KEY ({rel.join_column}) REFERENCES {target_table}({target_pk})"
                    )

                # Si es owner de MANY_TO_MANY, necesitamos una tabla intermedia
                if rel.persistence_owner and rel.relation_kind == "MANY_TO_MANY":
                    target_ent = entity_by_name.get(rel.target_entity)
                    target_table = target_ent.table_name if target_ent else cls._get_table_name(rel.target_entity, entities)
                    join_table = TableInfo(name=f"{entity.table_name}_{target_table}")

                    owner_sql = "UUID" if entity.id_field.java_type == "UUID" else "BIGINT"
                    target_sql = "UUID" if rel.target_id_type == "UUID" else "BIGINT"

                    col_owner = f"{entity.class_name.lower()}_id"
                    col_target = f"{rel.target_entity.lower()}_id"

                    # FK 1 (este lado)
                    join_table.columns.append(
                        ColumnInfo(
                            name=col_owner,
                            sql_type=owner_sql,
                            is_primary_key=False,
                            is_nullable=False,
                        )
                    )
                    # FK 2 (el otro lado)
                    join_table.columns.append(
                        ColumnInfo(
                            name=col_target,
                            sql_type=target_sql,
                            is_primary_key=False,
                            is_nullable=False,
                        )
                    )
                    join_table.foreign_keys.append(
                        f"PRIMARY KEY ({col_owner}, {col_target})"
                    )
                    join_table.foreign_keys.append(
                        f"FOREIGN KEY ({col_owner}) REFERENCES {entity.table_name}({entity.id_field.name})"
                    )
                    join_table.foreign_keys.append(
                        f"FOREIGN KEY ({col_target}) REFERENCES {target_table}({target_ent.id_field.name if target_ent else 'id'})"
                    )
                    join_tables.append(join_table)

            schema.tables.append(table)

        schema.tables.extend(join_tables)
        return schema

    @classmethod
    def _get_table_name(cls, class_name: str, entities: list[EntityInfo]) -> str:
        for e in entities:
            if e.class_name == class_name:
                return e.table_name
        # Fallback simple
        return f"{class_name.lower()}s"
