import json
from pathlib import Path
import sys

# Añadir backend al sys.path para importar los módulos de dominio
backend_dir = Path(__file__).resolve().parent.parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.modules.generator.domain.entity_info import EntityInfo
from app.modules.generator.domain.field_info import FieldInfo
from app.modules.generator.domain.relation_info import RelationInfo
from app.modules.generator.domain.mobile_schema_mapper import MobileSchemaMapper
from app.modules.generator.domain.ai_tools_mapper import AIToolsMapper
from app.modules.generator.domain.manifest_mapper import ManifestMapper


def generate_barberia():
    output_dir = Path(__file__).resolve().parent.parent / "apps" / "barberia"
    output_dir.mkdir(parents=True, exist_ok=True)

    cliente = EntityInfo(
        class_name="Cliente",
        table_name="clientes",
        resource_path="/api/clientes",
        id_field=FieldInfo(name="id", java_type="Long", sql_type="BIGINT", is_primary_key=True),
        fields=[
            FieldInfo(name="nombre", java_type="String", sql_type="VARCHAR(255)", is_nullable=False),
            FieldInfo(name="telefono", java_type="String", sql_type="VARCHAR(50)", is_nullable=True),
            FieldInfo(name="email", java_type="String", sql_type="VARCHAR(100)", is_nullable=True),
        ],
        relations=[],
    )

    barbero = EntityInfo(
        class_name="Barbero",
        table_name="barberos",
        resource_path="/api/barberos",
        id_field=FieldInfo(name="id", java_type="Long", sql_type="BIGINT", is_primary_key=True),
        fields=[
            FieldInfo(name="nombre", java_type="String", sql_type="VARCHAR(255)", is_nullable=False),
            FieldInfo(name="especialidad", java_type="String", sql_type="VARCHAR(100)", is_nullable=True),
            FieldInfo(name="experiencia_anios", java_type="Integer", sql_type="INTEGER", is_nullable=True),
        ],
        relations=[],
    )

    corte = EntityInfo(
        class_name="Corte",
        table_name="cortes",
        resource_path="/api/cortes",
        id_field=FieldInfo(name="id", java_type="Long", sql_type="BIGINT", is_primary_key=True),
        fields=[
            FieldInfo(name="nombre", java_type="String", sql_type="VARCHAR(255)", is_nullable=False),
            FieldInfo(name="precio", java_type="Double", sql_type="NUMERIC(10,2)", is_nullable=False),
            FieldInfo(name="duracion_minutos", java_type="Integer", sql_type="INTEGER", is_nullable=True),
        ],
        relations=[],
    )

    cita = EntityInfo(
        class_name="Cita",
        table_name="citas",
        resource_path="/api/citas",
        id_field=FieldInfo(name="id", java_type="Long", sql_type="BIGINT", is_primary_key=True),
        fields=[
            FieldInfo(name="fecha_hora", java_type="LocalDateTime", sql_type="TIMESTAMP", is_nullable=False),
            FieldInfo(name="estado", java_type="String", sql_type="VARCHAR(50)", is_nullable=False),
        ],
        relations=[
            RelationInfo(
                name="cliente",
                target_entity="Cliente",
                relation_kind="MANY_TO_ONE",
                persistence_owner=True,
                join_column="cliente_id",
            ),
            RelationInfo(
                name="barbero",
                target_entity="Barbero",
                relation_kind="MANY_TO_ONE",
                persistence_owner=True,
                join_column="barbero_id",
            ),
            RelationInfo(
                name="corte",
                target_entity="Corte",
                relation_kind="MANY_TO_ONE",
                persistence_owner=True,
                join_column="corte_id",
            ),
        ],
    )

    entities = [cliente, barbero, corte, cita]
    project_name = "barberia"
    domain = "barberia"

    # 1. Manifest
    manifest = ManifestMapper.map_manifest(project_name, domain=domain)
    with open(output_dir / "manifest.json", "w", encoding="utf-8") as f:
        f.write(manifest.model_dump_json(indent=2))

    # 2. Schema
    schema = MobileSchemaMapper.map_schema(project_name, entities, domain=domain)
    with open(output_dir / "schema.json", "w", encoding="utf-8") as f:
        f.write(schema.model_dump_json(indent=2))

    # 3. AI Tools (5 CRUD por entidad)
    ai_tools = AIToolsMapper.map_tools(project_name, entities, domain=domain)
    with open(output_dir / "ai-tools.json", "w", encoding="utf-8") as f:
        f.write(ai_tools.model_dump_json(indent=2))

    # 4. AI Context
    ai_context = AIToolsMapper.map_context(project_name, entities, domain=domain)
    with open(output_dir / "ai-context.json", "w", encoding="utf-8") as f:
        f.write(ai_context.model_dump_json(indent=2))

    # 5. Branding
    with open(output_dir / "branding.json", "w", encoding="utf-8") as f:
        f.write(manifest.branding.model_dump_json(indent=2))

    print(f"[OK] Aplicacion 'barberia' generada exitosamente en {output_dir}")


if __name__ == "__main__":
    generate_barberia()
