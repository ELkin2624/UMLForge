import re


def to_snake_case(name: str) -> str:
    """Convierte PascalCase o camelCase a snake_case."""
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def to_camel_case(name: str) -> str:
    """Convierte a camelCase (ej. Cliente -> cliente)."""
    if not name:
        return name
    return name[0].lower() + name[1:]


def pluralize(name: str) -> str:
    """
    Pluraliza una palabra asumiendo reglas básicas del español.
    - Si termina en vocal no acentuada, agrega 's'.
    - Si termina en consonante (o vocal acentuada), agrega 'es' (simplificado).
    """
    if not name:
        return name
    vowels = "aeiouáéíóúAEIOUÁÉÍÓÚ"
    if name[-1] in vowels:
        return name + "s"
    else:
        return name + "es"
