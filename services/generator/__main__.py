import argparse
import sys
from pathlib import Path

from canonical_model.model import UMLModel

from services.generator.application.generate_project import ProjectGenerator
from services.generator.infrastructure.filesystem_exporter import FilesystemExporter
from services.generator.infrastructure.zip_exporter import ZipExporter


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generador de proyectos Spring Boot desde Modelo Canónico UML"
    )
    parser.add_argument(
        "input_json", type=str, help="Ruta al archivo JSON del modelo UML"
    )
    parser.add_argument(
        "--output", type=str, default="generated/projects", help="Directorio de salida"
    )
    parser.add_argument(
        "--project-name", type=str, default="demo", help="Nombre del proyecto generado"
    )
    parser.add_argument(
        "--package", type=str, default="com.example.demo", help="Paquete base Java"
    )

    args = parser.parse_args()

    input_path = Path(args.input_json)
    if not input_path.exists():
        print(f"Error: No se encontró el archivo {args.input_json}")
        sys.exit(1)

    # Cargar modelo
    with open(input_path, "r", encoding="utf-8") as f:
        json_content = f.read()

    model = UMLModel.model_validate_json(json_content)

    print(
        f"Modelo cargado ({len(model.classes)} clases, {len(model.relationships)} relaciones)"
    )

    # Directorio de plantillas
    # Asumimos que ejecutamos desde la raíz del monorepo
    templates_dir = Path(__file__).parent / "templates"

    # Generar en memoria
    generator = ProjectGenerator(templates_dir=templates_dir)
    print("Iniciando generación...")

    try:
        project = generator.generate(model, args.project_name, args.package)
        print(f"Proyecto generado en memoria ({len(project.files)} archivos)")

        # Exportar a sistema de archivos
        output_dir = Path(args.output)
        output_dir.mkdir(parents=True, exist_ok=True)

        project_path = FilesystemExporter.export(project, output_dir)
        print(f"Proyecto escrito en {project_path}")

        # Exportar a ZIP
        zip_path = output_dir / f"{args.project_name}.zip"
        ZipExporter.export(project_path, zip_path)
        print(f"ZIP creado en {zip_path}")

        print("\n¡Generación completada exitosamente!")

    except Exception as e:
        print(f"Error durante la generación: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
