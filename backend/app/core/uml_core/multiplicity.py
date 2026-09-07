import re


class Multiplicity:
    """
    Representa y valida una multiplicidad UML, como '1', '0..*', '1..*', '*'.
    No usa Pydantic, es simplemente una abstracción de utilidad de Core UML.
    """

    # Expresión regular para validar el formato de la multiplicidad
    # Soporta: exactamente '1', '*', o un rango 'min..max' donde min es dígito y max es dígito o '*'
    _PATTERN = re.compile(r"^(\*|\d+|\d+\.\.(\*|\d+))$")

    @classmethod
    def is_valid(cls, value: str) -> bool:
        """
        Valida si un string de multiplicidad tiene el formato UML correcto.

        Args:
            value: La multiplicidad a validar (ej. '1', '0..*').

        Returns:
            True si es válido, False en caso contrario.
        """
        return bool(cls._PATTERN.match(value))
