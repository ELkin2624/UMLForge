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
