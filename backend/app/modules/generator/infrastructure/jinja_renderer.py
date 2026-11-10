from pathlib import Path

from jinja2 import Environment, FileSystemLoader


class JinjaRenderer:
    """
    Abstracción sobre Jinja2 para cargar plantillas y renderizarlas.
    """

    def __init__(self, templates_dir: str | Path):
        from ..domain.sql_values import add_foreign_key, constraint_sql, identifier

        self.env = Environment(
            loader=FileSystemLoader(str(templates_dir)),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
        )

        self.env.filters["sql_identifier"] = identifier
        self.env.filters["sql_constraint"] = constraint_sql
        self.env.filters["sql_add_fk"] = add_foreign_key

    def render(self, template_name: str, context: dict[str, object]) -> str:
        template = self.env.get_template(template_name)
        return template.render(**context)
