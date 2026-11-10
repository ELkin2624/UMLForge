"""Obtiene el diagrama del almacén (fuente de verdad) y construye el contexto para el agente.

El snapshot que envía el cliente solo se usa como RESPALDO (diagrama sin documento en el
almacén, o almacén caído) y así se indica en el contexto. Es código síncrono (pymongo y
análisis de CPU): el servicio lo ejecuta en un hilo para no bloquear el bucle de eventos.
"""

import logging
from typing import Any

from pydantic import ValidationError

from app.modules.data_design.schemas import DependencyDecision
from app.modules.data_design.service import analyze
from app.modules.diagram_store import DiagramRepository

from .context_builder import ContextResult, build_context

logger = logging.getLogger(__name__)

# El análisis de normalización es costoso: no se calcula para diagramas enormes.
MAX_CLASSES_FOR_ANALYSIS = 40


class ContextService:
    def __init__(self, repo: DiagramRepository) -> None:
        self.repo = repo

    def build(
        self,
        diagram_id: int,
        selection: list[str] | None,
        client_snapshot: dict[str, Any] | None,
    ) -> tuple[ContextResult, dict[str, Any]]:
        """Devuelve (contexto, datos del diagrama usados para construirlo)."""
        data, version, source, notes = self._load(diagram_id, client_snapshot)
        errors, warnings, forms = self._analyze(diagram_id, data, source)
        context = build_context(
            data,
            version=version,
            source=source,
            selection=selection,
            validation_errors=errors,
            validation_warnings=warnings,
            normal_forms=forms,
        )
        context.warnings = notes + context.warnings
        return context, data

    def _load(
        self, diagram_id: int, client_snapshot: dict[str, Any] | None
    ) -> tuple[dict[str, Any], int, str, list[str]]:
        try:
            if self.repo.has_document(diagram_id):
                return (
                    self.repo.get_data(diagram_id),
                    self.repo.current_version(diagram_id),
                    "server",
                    [],
                )
            note = "El diagrama aún no está guardado; se usa la copia del cliente."
        except Exception:  # almacén caído: la IA sigue funcionando con lo que envió el cliente
            logger.warning("No se pudo leer el diagrama %s del almacén", diagram_id, exc_info=True)
            note = "No se pudo leer el diagrama guardado; se usa la copia del cliente."
        return dict(client_snapshot or {}), 0, "client", [note]

    def _analyze(
        self, diagram_id: int, data: dict[str, Any], source: str
    ) -> tuple[list[str], list[str], list[tuple[str, str]]]:
        """Validación y formas normales; cualquier fallo solo omite la sección."""
        from app.core.canonical_model import UMLModel
        from app.core.validators import UMLValidator

        classes = data.get("classes")
        if not isinstance(classes, list) or not classes:
            return [], [], []

        errors: list[str] = []
        warnings: list[str] = []
        try:
            result = UMLValidator().validate(UMLModel.model_validate(data))
            errors, warnings = list(result.errors), list(result.warnings)
        except (ValidationError, ValueError, TypeError):
            pass  # modelo a medio construir: se omite la validación

        forms: list[tuple[str, str]] = []
        if len(classes) <= MAX_CLASSES_FOR_ANALYSIS:
            try:
                decisions: list[DependencyDecision] = []
                if source == "server":
                    decisions = [
                        DependencyDecision.model_validate(d)
                        for d in self.repo.get_dependencies(diagram_id)
                    ]
                design = analyze(data, decisions)
                forms = [(t.table, t.normal_form) for t in design.normalization]
            except Exception:  # incluye InvalidModelForDesign: se omite solo la sección
                logger.debug("Sin análisis de diseño de datos para %s", diagram_id, exc_info=True)
        return errors, warnings, forms
