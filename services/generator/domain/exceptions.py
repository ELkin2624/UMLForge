class GenerationError(Exception):
    """
    Excepción base para errores ocurridos durante el proceso de generación.
    """


class MappingError(GenerationError):
    """
    Excepción lanzada cuando una estructura del Modelo Canónico UML
    no puede ser mapeada de forma segura o soportada hacia la tecnología destino (JPA/Spring/SQL).
    """
