"""
Mapeador bidireccional determinista entre xmi:id y UUID canónico.
"""

from uuid import NAMESPACE_URL, UUID, uuid5


class IDMapper:
    """
    Gestiona la correspondencia bidireccional entre identificadores XMI (que pueden ser
    alfanuméricos como EAID_... o UUIDs) y UUIDs canónicos del CanonicalModel.
    """

    def __init__(self, doc_fingerprint: str = "default") -> None:
        self.doc_fingerprint = doc_fingerprint
        self._xmi_to_uuid: dict[str, UUID] = {}
        self._uuid_to_xmi: dict[UUID, str] = {}

    def register(self, xmi_id: str) -> UUID:
        """
        Registra un xmi:id y retorna su UUID canónico correspondiente.
        - Si ya está registrado, retorna el UUID existente.
        - Si es un UUID RFC 4122 válido, lo utiliza directamente.
        - Si es alfanumérico, genera un UUID5 determinista con la huella del documento.
        """
        if xmi_id in self._xmi_to_uuid:
            return self._xmi_to_uuid[xmi_id]

        try:
            # Intento de parsear como UUID nativo
            canonical_uuid = UUID(xmi_id)
        except ValueError:
            # Generar UUID5 determinista
            canonical_uuid = uuid5(
                NAMESPACE_URL, f"umlforge:xmi:{self.doc_fingerprint}:{xmi_id}"
            )

        self._xmi_to_uuid[xmi_id] = canonical_uuid
        self._uuid_to_xmi[canonical_uuid] = xmi_id
        return canonical_uuid

    def get_uuid(self, xmi_id: str) -> UUID | None:
        """
        Obtiene el UUID canónico a partir de un xmi:id si fue registrado previamente.
        """
        return self._xmi_to_uuid.get(xmi_id)

    def get_xmi_id(self, uuid_val: UUID | str) -> str | None:
        """
        Obtiene el xmi:id original a partir de un UUID canónico si fue registrado previamente.
        """
        if isinstance(uuid_val, str):
            try:
                uuid_val = UUID(uuid_val)
            except ValueError:
                return None
        return self._uuid_to_xmi.get(uuid_val)

    def register_canonical(self, uuid_val: UUID | str, prefix: str = "EAID_") -> str:
        """
        Garantiza que un UUID canónico tenga un xmi:id asignado para exportación.
        Si ya existía un xmi:id, lo retorna. De lo contrario, genera uno legible.
        Acepta tanto UUIDs RFC 4122 como identificadores arbitrarios (ej: 'id-timestamp-rand').
        """
        if isinstance(uuid_val, str):
            try:
                parsed_uuid = UUID(uuid_val)
            except ValueError:
                # Identificador no estándar (ej: generado por el parser de voz).
                # Generar UUID5 determinista para mantener consistencia en la exportación.
                parsed_uuid = uuid5(
                    NAMESPACE_URL, f"umlforge:canonical:{uuid_val}"
                )
        else:
            parsed_uuid = uuid_val

        if parsed_uuid in self._uuid_to_xmi:
            return self._uuid_to_xmi[parsed_uuid]

        # Generar xmi_id compatible con Enterprise Architect
        generated_xmi_id = f"{prefix}{str(parsed_uuid).replace('-', '_').upper()}"
        self._uuid_to_xmi[parsed_uuid] = generated_xmi_id
        self._xmi_to_uuid[generated_xmi_id] = parsed_uuid
        return generated_xmi_id
