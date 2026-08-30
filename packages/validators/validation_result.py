from dataclasses import dataclass, field


@dataclass
class ValidationResult:
    """
    Estructura para almacenar el resultado de una validación UML.
    Contiene si el modelo es válido, los errores (que impiden su uso)
    y las advertencias (que podrían indicar malas prácticas o defaults).
    """

    valid: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def add_error(self, message: str) -> None:
        self.errors.append(message)
        self.valid = False

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)
