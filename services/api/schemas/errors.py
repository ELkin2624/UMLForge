from typing import Any


class APIError(Exception):
    """Base class for API exceptions"""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class InvalidModelError(APIError):
    def __init__(
        self,
        message: str = "Invalid UML Model",
        errors: list[dict[str, Any]] | None = None,
    ):
        super().__init__(message, status_code=422)
        self.errors = errors or []


class GenerationError(APIError):
    def __init__(self, message: str = "Error generating project"):
        super().__init__(message, status_code=500)


class NotImplementedFeatureError(APIError):
    def __init__(self, message: str = "Feature not implemented"):
        super().__init__(message, status_code=501)


class ComponentDiagramUnsupportedError(APIError):
    """
    Error 422 lanzado cuando se intenta generar código Spring Boot
    a partir de un modelo que contiene diagramas o elementos de componentes.
    """

    def __init__(
        self,
        message: str = "La generación Spring Boot no admite diagramas de componentes en esta versión.",
        code: str = "GEN_COMPONENT_DIAGRAM_UNSUPPORTED",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message, status_code=422)
        self.code = code
        self.details = details or {}
