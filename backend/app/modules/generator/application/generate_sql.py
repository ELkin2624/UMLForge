"""Generación SQL independiente, sin escribir proyectos al disco."""

from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from app.core.canonical_model.model import UMLModel
from app.modules.generator.infrastructure.jinja_renderer import JinjaRenderer

from .prepare_relational import prepare_relational


def generate_sql(
    model: UMLModel, mode: str, rows: int, templates_dir: Path
) -> tuple[bytes, str, str]:
    artifacts = prepare_relational(model, rows, include_data=mode != "schema")
    files: dict[str, str] = {}
    if mode != "data":
        files["schema.sql"] = JinjaRenderer(templates_dir).render(
            "database/schema.sql.j2", {"schema": artifacts.schema}
        )
    if mode != "schema":
        files["data.sql"] = (
            "-- Datos sintéticos. Requiere el esquema compatible y vacío.\n"
            "BEGIN;\nSET LOCAL standard_conforming_strings = on;\n"
            + "\n".join(artifacts.dataset.sql_statements)
            + "\nCOMMIT;\n"
        )
    if len(files) == 1:
        filename, content = next(iter(files.items()))
        return content.encode(), filename, "application/sql"
    files["README.txt"] = (
        "SQL PostgreSQL generado desde el diagrama actual.\n"
        "Ejecutar en una base vacía: primero schema.sql y después data.sql.\n"
        "psql -v ON_ERROR_STOP=1 -d BASE -f schema.sql\n"
        "psql -v ON_ERROR_STOP=1 -d BASE -f data.sql\n"
        "Las normalizaciones propuestas no aplicadas al diagrama no se exportan.\n"
        "Los datos se generan con reglas locales; no se infieren reglas comerciales ausentes.\n"
    )
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for filename, content in files.items():
            archive.writestr(filename, content)
    return output.getvalue(), "database.zip", "application/zip"
