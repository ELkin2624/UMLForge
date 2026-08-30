from services.generator.domain.type_mapper import TypeMapper


def test_type_mapper_java():
    assert TypeMapper.get_java_type("String") == "String"
    assert TypeMapper.get_java_type("Date") == "LocalDate"
    assert TypeMapper.get_java_type("DateTime") == "LocalDateTime"
    assert TypeMapper.get_java_type("BigDecimal") == "BigDecimal"
    assert TypeMapper.get_java_type("CustomType") == "CustomType"  # Fallback


def test_type_mapper_sql():
    assert TypeMapper.get_sql_type("String") == "VARCHAR(255)"
    assert TypeMapper.get_sql_type("Long") == "BIGINT"
    assert TypeMapper.get_sql_type("DateTime") == "TIMESTAMP"
    assert TypeMapper.get_sql_type("CustomType") == "VARCHAR(255)"  # Fallback
