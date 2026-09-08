import re


class TypeMapper:
    """
    Traduce tipos UML a tipos específicos de la tecnología destino (Java 21, PostgreSQL).
    """

    _CANONICAL_TYPES = {
        "string": ("String", "VARCHAR(255)"),
        "str": ("String", "VARCHAR(255)"),
        "text": ("String", "TEXT"),
        "integer": ("Integer", "INTEGER"),
        "int": ("Integer", "INTEGER"),
        "long": ("Long", "BIGINT"),
        "bigint": ("Long", "BIGINT"),
        "boolean": ("Boolean", "BOOLEAN"),
        "bool": ("Boolean", "BOOLEAN"),
        "double": ("Double", "DOUBLE PRECISION"),
        "float": ("Double", "DOUBLE PRECISION"),
        "bigdecimal": ("BigDecimal", "NUMERIC(19,4)"),
        "decimal": ("BigDecimal", "NUMERIC(19,4)"),
        "date": ("LocalDate", "DATE"),
        "localdate": ("LocalDate", "DATE"),
        "datetime": ("LocalDateTime", "TIMESTAMP"),
        "localdatetime": ("LocalDateTime", "TIMESTAMP"),
        "instant": ("Instant", "TIMESTAMP WITH TIME ZONE"),
        "uuid": ("UUID", "UUID"),
    }

    _UUID_PATTERN = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
    )

    @classmethod
    def get_java_type(cls, uml_type: str) -> str:
        if not uml_type:
            return "String"
        key = uml_type.strip().lower()
        if key in cls._CANONICAL_TYPES:
            return cls._CANONICAL_TYPES[key][0]
        # Si parece un UUID interno sin mapear (común en importadores XMI incompletos), sanitizar a String
        if cls._UUID_PATTERN.match(uml_type.strip()):
            return "String"
        # Si es un nombre válido de identificador Java (ej. nombre de otra clase/enum), conservarlo
        if re.match(r"^[A-Z][a-zA-Z0-9_]*$", uml_type.strip()):
            return uml_type.strip()
        return "String"

    @classmethod
    def get_sql_type(cls, uml_type: str) -> str:
        if not uml_type:
            return "VARCHAR(255)"
        key = uml_type.strip().lower()
        if key in cls._CANONICAL_TYPES:
            return cls._CANONICAL_TYPES[key][1]
        return "VARCHAR(255)"
