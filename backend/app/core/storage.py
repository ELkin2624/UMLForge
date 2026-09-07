import hashlib
import shutil
from pathlib import Path


class StorageService:
    def __init__(self, base_output_dir: str):
        self.base_output_dir = Path(base_output_dir)
        self.base_output_dir.mkdir(parents=True, exist_ok=True)

    def calculate_checksum(self, file_path: Path) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def cleanup_path(self, path: Path) -> None:
        """Borra el directorio o archivo si existe."""
        if not path.exists():
            return
        if path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)
