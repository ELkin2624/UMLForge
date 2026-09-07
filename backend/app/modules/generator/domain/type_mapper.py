class TypeMapper:
    """
    Traduce tipos UML a tipos específicos de la tecnología destino (Java 21, PostgreSQL).
    """

    UML_TO_JAVA = {
        "String": "String",
        "Integer": "Integer",
        "Long": "Long",
        "Boolean": "Boolean",
        "Double": "Double",
        "BigDecimal": "BigDecimal",
        "Date": "LocalDate",
        "DateTime": "LocalDateTime",
        "UUID": "UUID",
    }

    UML_TO_SQL = {
        "String": "VARCHAR(255)",
        "Integer": "INTEGER",
        "Long": "BIGINT",
        "Boolean": "BOOLEAN",
        "Double": "DOUBLE PRECISION",
        "BigDecimal": "NUMERIC(19,4)",
        "Date": "DATE",
        "DateTime": "TIMESTAMP",
        "UUID": "UUID",
    }

    @classmethod
    def get_java_type(cls, uml_type: str) -> str:
        # Fallback a String si no se reconoce, o si es un tipo complejo (referencia a otra clase, aunque las relaciones
        # deberían manejarse por relationship_mapper, si llega aquí como atributo base, devolvemos el mismo nombre)
        return cls.UML_TO_JAVA.get(uml_type, uml_type)

    @classmethod
    def get_sql_type(cls, uml_type: str) -> str:
        # Si es un tipo complejo que se coló como atributo, por defecto VARCHAR o BIGINT dependiendo de si es id
        return cls.UML_TO_SQL.get(uml_type, "VARCHAR(255)")
