from pathlib import Path

from services.generator.domain.generated_project import GeneratedProject


class FilesystemExporter:
    @classmethod
    def export(cls, project: GeneratedProject, output_dir: str | Path) -> Path:
        base_path = Path(output_dir) / project.name

        # Escribir los archivos
        for file in project.files:
            file_path = base_path / file.path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(file.content)

        # Escribir manifiesto
        manifest_path = base_path / "generation-manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write(project.manifest.model_dump_json(indent=2))

        return base_path
