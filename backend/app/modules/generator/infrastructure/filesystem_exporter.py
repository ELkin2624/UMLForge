from pathlib import Path

from app.modules.generator.domain.generated_project import GeneratedProject


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

        # Si existe mobile/apps en la raíz del monorepo, sincronizar la app directamente
        try:
            workspace_mobile_apps = Path.cwd() / "mobile" / "apps"
            if not workspace_mobile_apps.exists():
                # Buscar en directorio padre
                workspace_mobile_apps = Path(__file__).resolve().parents[5] / "mobile" / "apps"

            if workspace_mobile_apps.exists():
                target_app_dir = workspace_mobile_apps / project.name
                target_app_dir.mkdir(parents=True, exist_ok=True)
                current_app_dir = workspace_mobile_apps / "current"
                current_app_dir.mkdir(parents=True, exist_ok=True)
                for file in project.files:
                    if file.path.startswith(f"mobile/{project.name}/"):
                        filename = Path(file.path).name
                        with open(target_app_dir / filename, "w", encoding="utf-8") as f:
                            f.write(file.content)
                        with open(current_app_dir / filename, "w", encoding="utf-8") as f:
                            f.write(file.content)
        except Exception:
            pass

        return base_path
