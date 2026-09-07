from app.core.canonical_model.model import UMLModel

from .component_rules import ComponentValidator
from .structural_validator import StructuralValidator
from .validation_result import ValidationResult


class UMLValidator:
    """
    Orquesta las diferentes validaciones UML sobre el modelo canónico.
    Diferencia entre validación de esquema (Pydantic) y semántica/estructural (UMLValidator).
    """

    def __init__(self) -> None:
        self.structural_validator = StructuralValidator()
        self.component_validator = ComponentValidator()

    def validate(self, model: UMLModel) -> ValidationResult:
        result = ValidationResult()

        # Validaciones estructurales y de componentes
        self.structural_validator.validate(model, result)
        self.component_validator.validate(model, result)

        return result
