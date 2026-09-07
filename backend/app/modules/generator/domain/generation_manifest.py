from pydantic import BaseModel, Field


class GenerationManifest(BaseModel):
    """
    Manifiesto que documenta el resultado de la generación.
    """

    generator_version: str = Field(default="0.1.0")
    uml_version: str = Field(default="2.5.1")
    project_name: str = Field(...)
    total_files: int = Field(default=0)
    total_entities: int = Field(default=0)
    total_relationships: int = Field(default=0)
    total_endpoints: int = Field(default=0)
