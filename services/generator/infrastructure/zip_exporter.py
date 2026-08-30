import shutil
from pathlib import Path


class ZipExporter:
    @classmethod
    def export(cls, source_dir: str | Path, output_zip_path: str | Path) -> Path:
        source_dir = Path(source_dir)
        output_zip_path = Path(output_zip_path)

        # shutil.make_archive agrega la extensión automáticamente, así que le quitamos '.zip'
        base_name = str(output_zip_path.with_suffix(""))

        shutil.make_archive(
            base_name, "zip", root_dir=source_dir.parent, base_dir=source_dir.name
        )

        return output_zip_path
