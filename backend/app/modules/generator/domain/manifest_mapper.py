from pydantic import BaseModel, Field


class BackendConfig(BaseModel):
    base_url: str = "http://localhost:8000"


class AIConfig(BaseModel):
    enabled: bool = True
    driver: str = "llama-native"  # llama-native, ollama-http, mock
    model: str = "qwen2.5-0.5b-instruct"
    fallback_driver: str = "ollama-http"


class BrandingConfig(BaseModel):
    app_title: str
    primary_color: str = "#A67917"  # Paleta Holst
    secondary_color: str = "#CC961F"
    background_color: str = "#FFF3D8"
    dark_color: str = "#5A4A0D"


class MobileManifestInfo(BaseModel):
    project: str
    display_name: str
    version: str = "1.0.0"
    domain: str = "general"
    schema_version: str = "1.0"
    generator_version: str = "0.8.0"
    backend: BackendConfig = Field(default_factory=BackendConfig)
    ai: AIConfig = Field(default_factory=AIConfig)
    branding: BrandingConfig


class ManifestMapper:
    @classmethod
    def map_manifest(
        cls, project_name: str, domain: str = "general"
    ) -> MobileManifestInfo:
        display_name = project_name.replace("-", " ").replace("_", " ").title()

        # Custom branding based on domain if applicable
        primary = "#A67917"
        secondary = "#CC961F"
        bg = "#FFF3D8"
        dark = "#5A4A0D"

        return MobileManifestInfo(
            project=project_name,
            display_name=display_name,
            version="1.0.0",
            domain=domain,
            schema_version="1.0",
            generator_version="0.8.0",
            backend=BackendConfig(base_url="http://localhost:8000"),
            ai=AIConfig(
                enabled=True,
                driver="llama-native",
                model="qwen2.5-0.5b-instruct",
                fallback_driver="ollama-http",
            ),
            branding=BrandingConfig(
                app_title=display_name,
                primary_color=primary,
                secondary_color=secondary,
                background_color=bg,
                dark_color=dark,
            ),
        )
