import re

from canonical_model.model import UMLModel

from validators.validation_result import ValidationResult


class GenerationValidator:
    """
    Valida si un modelo canónico (que ya es estructuralmente válido)
    es apto para la generación de código backend en esta Fase.
    Identifica elementos no soportados (ej. Componentes, Interfaces no soportadas, o nombres inválidos).
    """

    def validate(self, model: UMLModel, result: ValidationResult) -> None:
        # Validación 1: Sanitización de nombres de proyecto / clases
        if not re.match(r"^[a-zA-Z0-9_-]+$", model.id):
            result.add_error(
                f"GEN-001: El ID del modelo '{model.id}' contiene caracteres inválidos. Solo se permiten alfanuméricos, guiones y guiones bajos."
            )

        for cls in model.classes:
            if not re.match(r"^[A-Z][a-zA-Z0-9]*$", cls.name):
                result.add_warning(
                    f"GEN-002: El nombre de la clase '{cls.name}' ({cls.id}) debería usar PascalCase."
                )

            # Revisión de atributos
            for attr in cls.attributes:
                if not re.match(r"^[a-z][a-zA-Z0-9]*$", attr.name):
                    result.add_warning(
                        f"GEN-003: El atributo '{attr.name}' en la clase '{cls.name}' debería usar camelCase."
                    )

        # Validación 2: Elementos no soportados en JPA generación actual
        if len(model.components) > 0:
            result.add_error(
                "GEN-010: El modelo contiene Componentes, los cuales no están soportados por el generador JPA en esta fase."
            )

        if len(model.interfaces) > 0:
            result.add_error(
                "GEN-011: El modelo contiene Interfaces, las cuales no están soportadas por el generador JPA en esta fase."
            )

        # Validación 3: Relaciones sin owner explícito en ManyToMany (aunque en esta etapa de validación no tenemos
        # toda la lógica del mapper, podemos dejar este warning como placeholder para cuando integremos el MappingProfile)
        for rel in model.relationships:
            # Check relation multiplicities
            # Si ambos son * (ManyToMany) y no hay información adicional
            if rel.source_multiplicity in (
                "*",
                "0..*",
                "1..*",
            ) and rel.target_multiplicity in ("*", "0..*", "1..*"):
                result.add_warning(
                    f"GEN-021: No se especificó ownership explícito de persistencia para la relación {rel.name} (ManyToMany). Se utilizará el source ({rel.source}) como lado propietario por defecto."
                )
