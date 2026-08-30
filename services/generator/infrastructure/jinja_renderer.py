from pathlib import Path

from jinja2 import Environment, FileSystemLoader


class JinjaRenderer:
    """
    Abstracción sobre Jinja2 para cargar plantillas y renderizarlas.
    """

    def __init__(self, templates_dir: str | Path):
        self.env = Environment(
            loader=FileSystemLoader(str(templates_dir)),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def render(self, template_name: str, context: dict[str, object]) -> str:
        template = self.env.get_template(template_name)
        return template.render(**context)
