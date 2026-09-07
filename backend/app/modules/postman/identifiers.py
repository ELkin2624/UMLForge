import uuid


def deterministic_uuid(key: str) -> str:
    """
    Genera un UUID5 determinista utilizando el namespace URL
    y una clave proporcionada.
    """
    return str(uuid.uuid5(uuid.NAMESPACE_URL, key))
