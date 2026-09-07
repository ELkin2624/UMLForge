from typing import Any

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    # El JSON original puede enviarse directamente o envuelto
    # Para ser flexibles, el endpoint podría recibir directamente el JSON del UML.
    # Pero si se necesitan parámetros adicionales:
    model_data: dict[str, Any] = Field(..., description="JSON del Modelo UML")
    project_name: str = Field(
        default="demo", description="Nombre del proyecto Spring Boot"
    )
    package_name: str = Field(
        default="com.example.demo", description="Paquete base de Java"
    )


from pydantic import BaseModel, Field


class APIErrorDetail(BaseModel):
    code: str = Field(default="unknown")
    message: str
    path: str | None = None
    severity: str = Field(default="error", description="'error' or 'warning'")


class ValidationResultResponse(BaseModel):
    is_valid: bool
    errors: list[APIErrorDetail] = Field(default_factory=list)


class GenerateResponse(BaseModel):
    project_name: str
    download_url: str | None = None
    checksum: str | None = None
    warnings: list[APIErrorDetail] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    status: int
    detail: str
    errors: list[APIErrorDetail] = Field(default_factory=list)
