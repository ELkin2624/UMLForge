import re


class TypeMapper:
    """
    Traduce tipos UML a tipos específicos de la tecnología destino (Java 21, PostgreSQL).
    """

    _CANONICAL_TYPES = {
        "string": ("String", "VARCHAR(255)"),
        "str": ("String", "VARCHAR(255)"),
        "text": ("String", "TEXT"),
        "varchar": ("String", "VARCHAR(255)"),
        "varchar2": ("String", "VARCHAR(255)"),
        "char": ("String", "VARCHAR(255)"),
        "character": ("String", "VARCHAR(255)"),
        "clob": ("String", "TEXT"),
        "integer": ("Integer", "INTEGER"),
        "int": ("Integer", "INTEGER"),
        "int4": ("Integer", "INTEGER"),
        "int8": ("Long", "BIGINT"),
        "number": ("Long", "BIGINT"),
        "numeric": ("BigDecimal", "NUMERIC(19,4)"),
        "long": ("Long", "BIGINT"),
        "bigint": ("Long", "BIGINT"),
        "serial": ("Long", "BIGSERIAL"),
        "bigserial": ("Long", "BIGSERIAL"),
        "boolean": ("Boolean", "BOOLEAN"),
        "bool": ("Boolean", "BOOLEAN"),
        "byte": ("Byte", "SMALLINT"),
        "short": ("Short", "SMALLINT"),
        "double": ("Double", "DOUBLE PRECISION"),
        "float": ("Float", "REAL"),
        "real": ("Float", "REAL"),
        "bigdecimal": ("BigDecimal", "NUMERIC(19,4)"),
        "decimal": ("BigDecimal", "NUMERIC(19,4)"),
        "money": ("BigDecimal", "NUMERIC(19,4)"),
        "date": ("LocalDate", "DATE"),
        "localdate": ("LocalDate", "DATE"),
        "datetime": ("LocalDateTime", "TIMESTAMP"),
        "localdatetime": ("LocalDateTime", "TIMESTAMP"),
        "timestamp": ("LocalDateTime", "TIMESTAMP"),
        "time": ("LocalTime", "TIME"),
        "localtime": ("LocalTime", "TIME"),
        "instant": ("Instant", "TIMESTAMP WITH TIME ZONE"),
        "timestamptz": ("Instant", "TIMESTAMP WITH TIME ZONE"),
        "uuid": ("UUID", "UUID"),
        "json": ("String", "TEXT"),
        "jsonb": ("String", "TEXT"),
        "blob": ("byte[]", "BYTEA"),
        "bytea": ("byte[]", "BYTEA"),
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
