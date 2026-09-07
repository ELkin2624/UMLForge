from pydantic import BaseModel, Field

from .generation_manifest import GenerationManifest


class GeneratedFile(BaseModel):
    """
    Representa un archivo generado en memoria.
    """

    path: str = Field(
        ...,
        description="Ruta relativa del archivo dentro del proyecto generado (ej. 'src/main/java/com/example/Application.java')",
    )
    content: str = Field(..., description="Contenido en texto plano del archivo")
    media_type: str = Field(
        default="text/plain", description="Tipo de contenido (MIME)"
    )


class GeneratedProject(BaseModel):
    """
    Representa el resultado completo de la generación, conteniendo todos los archivos en memoria.
    """

    name: str = Field(..., description="Nombre del proyecto seguro (sanitizado)")
    files: list[GeneratedFile] = Field(
        default_factory=list, description="Lista de archivos generados"
    )
    manifest: GenerationManifest = Field(
        ..., description="Manifiesto con metadatos de la generación"
    )
