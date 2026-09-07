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

            # Basic Fields
            for field in entity.fields:
                table.columns.append(
                    ColumnInfo(
                        name=field.name,
                        sql_type=field.sql_type,
                        is_primary_key=False,
                        is_nullable=field.is_nullable,
                    )
                )

            # Foreign Keys (for ManyToOne / OneToOne owners)
            for rel in entity.relations:
                if rel.persistence_owner and rel.join_column:
                    # Agregamos la columna foránea físicamente a la tabla
                    table.columns.append(
                        ColumnInfo(
                            name=rel.join_column,
                            sql_type="BIGINT",  # Asumimos Long/BIGINT para IDs por defecto
                            is_primary_key=False,
                            is_nullable=True,  # Opcional según multiplicidad, dejamos True por defecto
                        )
                    )
                    table.foreign_keys.append(
                        f"FOREIGN KEY ({rel.join_column}) REFERENCES {cls._get_table_name(rel.target_entity, entities)}(id)"
                    )

                # Si es owner de MANY_TO_MANY, necesitamos una tabla intermedia
                if rel.persistence_owner and rel.relation_kind == "MANY_TO_MANY":
                    join_table = TableInfo(
                        name=f"{entity.table_name}_{cls._get_table_name(rel.target_entity, entities)}"
                    )
                    # FK 1 (este lado)
                    join_table.columns.append(
                        ColumnInfo(
                            name=f"{entity.class_name.lower()}_id",
                            sql_type="BIGINT",
                            is_primary_key=True,
                            is_nullable=False,
                        )
                    )
                    # FK 2 (el otro lado)
                    join_table.columns.append(
                        ColumnInfo(
                            name=f"{rel.target_entity.lower()}_id",
                            sql_type="BIGINT",
                            is_primary_key=True,
                            is_nullable=False,
                        )
                    )
                    schema.tables.append(join_table)

            schema.tables.append(table)

        return schema

    @classmethod
    def _get_table_name(cls, class_name: str, entities: list[EntityInfo]) -> str:
        for e in entities:
            if e.class_name == class_name:
                return e.table_name
        # Fallback simple
        return f"{class_name.lower()}s"
