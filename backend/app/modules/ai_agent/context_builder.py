"""Resumen compacto del diagrama para el prompt del agente (funciones puras).

Trabaja sobre el dict que guarda el almacén (formato canónico del frontend), de forma tolerante:
un diagrama a medio construir no debe romper la consulta a la IA.

Prioridad cuando hay que recortar por presupuesto de tokens:
1. lo que el usuario tiene seleccionado y sus vecinas (siempre, con detalle),
2. validación y diseño de datos (secciones cortas),
3. clases con detalle, ordenadas por relevancia (seleccionadas, vecinas, más conectadas),
4. relaciones; lo que no entra se resume ("solo nombre", "y K más") y se avisa en `warnings`.
"""

from dataclasses import dataclass, field
from typing import Any

CHARS_PER_TOKEN = 4
DEFAULT_BUDGET_TOKENS = 3000
MAX_NAME_CHARS = 80
MAX_ATTRS_PER_CLASS = 40
MAX_OPS_PER_CLASS = 20
MAX_LISTED_ISSUES = 8
MAX_LISTED_TABLES = 12
# Margen para las notas de recorte, que siempre deben caber.
RESERVE_CHARS = 400


def estimate_tokens(text: str) -> int:
    return (len(text) + CHARS_PER_TOKEN - 1) // CHARS_PER_TOKEN


@dataclass
class ContextResult:
    text: str
    version: int
    source: str  # "server" (almacén) o "client" (respaldo)
    classes: int
    relationships: int
    approx_tokens: int
    truncated: bool = False
    warnings: list[str] = field(default_factory=list)

    def info(self) -> dict[str, Any]:
        """Metadatos para el cliente (sin el texto del prompt)."""
        return {
            "source": self.source,
            "version": self.version,
            "classes": self.classes,
            "relationships": self.relationships,
            "approx_tokens": self.approx_tokens,
            "truncated": self.truncated,
            "warnings": self.warnings,
        }


def _clip(value: Any, limit: int = MAX_NAME_CHARS) -> str:
    text = str(value if value is not None else "").replace("\n", " ").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _dicts(value: Any) -> list[dict[str, Any]]:
    return [x for x in value if isinstance(x, dict)] if isinstance(value, list) else []


def _endpoint(rel: dict[str, Any], side: str) -> str:
    return str(rel.get(f"{side}_id") or rel.get(side) or "")


class _Budget:
    def __init__(self, tokens: int) -> None:
        self.limit = max(tokens, 1) * CHARS_PER_TOKEN
        self.used = 0

    def fits(self, line: str, reserve: int = RESERVE_CHARS) -> bool:
        return self.used + len(line) + 1 <= self.limit - reserve

    def add(self, lines: list[str], line: str, force: bool = False) -> bool:
        if force or self.fits(line):
            lines.append(line)
            self.used += len(line) + 1
            return True
        return False


def _class_line(cls: dict[str, Any], mark: str = "-") -> str:
    attrs = _dicts(cls.get("attributes"))
    ops = _dicts(cls.get("operations"))
    parts = []
    for a in attrs[:MAX_ATTRS_PER_CLASS]:
        pk = " PK" if a.get("is_primary_key") else ""
        parts.append(f"{_clip(a.get('name'))}:{_clip(a.get('type'), 40)}{pk}")
    if len(attrs) > MAX_ATTRS_PER_CLASS:
        parts.append(f"…(+{len(attrs) - MAX_ATTRS_PER_CLASS} atributos)")
    line = f"{mark} {_clip(cls.get('name'))}"
    if cls.get("is_abstract"):
        line += " (abstracta)"
    line += f" [{', '.join(parts)}]" if parts else " []"
    if ops:
        names = [f"{_clip(o.get('name'))}()" for o in ops[:MAX_OPS_PER_CLASS]]
        if len(ops) > MAX_OPS_PER_CLASS:
            names.append(f"…(+{len(ops) - MAX_OPS_PER_CLASS})")
        line += f" ops: {', '.join(names)}"
    return line


def _relation_line(rel: dict[str, Any], names: dict[str, str]) -> str:
    src = names.get(_endpoint(rel, "source"), _endpoint(rel, "source") or "?")
    dst = names.get(_endpoint(rel, "target"), _endpoint(rel, "target") or "?")
    sm = rel.get("source_multiplicity") or "1"
    tm = rel.get("target_multiplicity") or "1"
    return f"- {_clip(src)} [{_clip(sm, 12)}] —{_clip(rel.get('type') or 'association', 24)}→ [{_clip(tm, 12)}] {_clip(dst)}"


def build_context(
    data: dict[str, Any],
    *,
    version: int = 0,
    source: str = "server",
    selection: list[str] | None = None,
    validation_errors: list[str] | None = None,
    validation_warnings: list[str] | None = None,
    normal_forms: list[tuple[str, str]] | None = None,
    budget_tokens: int = DEFAULT_BUDGET_TOKENS,
) -> ContextResult:
    classes = _dicts((data or {}).get("classes"))
    relationships = _dicts((data or {}).get("relationships"))
    warnings: list[str] = []
    truncated = False

    by_id = {str(c.get("id")): c for c in classes if c.get("id") is not None}
    names = {cid: _clip(c.get("name")) for cid, c in by_id.items()}
    by_name = {str(c.get("name", "")).strip().lower(): c for c in classes}

    # --- Resolver la selección (ids o nombres; clases o relaciones) ----------
    selected_ids: set[str] = set()
    selected_rels: list[dict[str, Any]] = []
    for item in (selection or [])[:20]:
        key = str(item).strip()
        if key in by_id:
            selected_ids.add(key)
        elif (cls := by_name.get(key.lower())) is not None and cls.get("id") is not None:
            selected_ids.add(str(cls["id"]))
        else:
            rel = next((r for r in relationships if str(r.get("id")) == key), None)
            if rel is not None:
                selected_rels.append(rel)
                selected_ids.update({_endpoint(rel, "source"), _endpoint(rel, "target")} & by_id.keys())
            else:
                warnings.append(f"La selección «{_clip(key, 40)}» ya no existe en el diagrama.")

    neighbors: set[str] = set()
    degree: dict[str, int] = {cid: 0 for cid in by_id}
    for r in relationships:
        s, t = _endpoint(r, "source"), _endpoint(r, "target")
        for end in (s, t):
            if end in degree:
                degree[end] += 1
        if s in selected_ids and t in by_id:
            neighbors.add(t)
        if t in selected_ids and s in by_id:
            neighbors.add(s)
    neighbors -= selected_ids

    def relevance(cls: dict[str, Any]) -> tuple[int, int, str]:
        cid = str(cls.get("id"))
        tier = 0 if cid in selected_ids else 1 if cid in neighbors else 2
        return (tier, -degree.get(cid, 0), str(cls.get("name", "")).lower())

    ordered = sorted(classes, key=relevance)
    budget = _Budget(budget_tokens)
    lines: list[str] = []

    origin = "almacén del servidor" if source == "server" else "copia enviada por el cliente"
    budget.add(
        lines,
        f"DIAGRAMA (versión {version}, {origin}): {len(classes)} clases, {len(relationships)} relaciones.",
        force=True,
    )

    # --- 1. Selección: siempre, con detalle ----------------------------------
    if selected_ids or selected_rels:
        budget.add(lines, "SELECCIÓN DEL USUARIO (sobre esto se refiere el mensaje):", force=True)
        for cls in ordered:
            if str(cls.get("id")) in selected_ids:
                budget.add(lines, _class_line(cls, "*"), force=True)
        for rel in selected_rels:
            budget.add(lines, _relation_line(rel, names), force=True)
        near = [c for c in ordered if str(c.get("id")) in neighbors]
        if near:
            budget.add(lines, f"Vecinas directas: {', '.join(names[str(c['id'])] for c in near[:15])}", force=True)

    # --- 2. Validación y diseño de datos (cortas) ----------------------------
    if validation_errors or validation_warnings:
        budget.add(lines, "VALIDACIÓN:", force=True)
        for label, items in (("error", validation_errors or []), ("advertencia", validation_warnings or [])):
            for msg in items[:MAX_LISTED_ISSUES]:
                budget.add(lines, f"- {label}: {_clip(msg, 160)}")
            if len(items) > MAX_LISTED_ISSUES:
                budget.add(lines, f"- …y {len(items) - MAX_LISTED_ISSUES} {label}(s) más")
    if normal_forms:
        shown = normal_forms[:MAX_LISTED_TABLES]
        budget.add(
            lines,
            "FORMA NORMAL POR TABLA: " + ", ".join(f"{_clip(t, 40)}={nf}" for t, nf in shown)
            + (f" …(+{len(normal_forms) - len(shown)})" if len(normal_forms) > len(shown) else ""),
        )

    # --- 3. Clases: con detalle mientras quepa --------------------------------
    pending = [c for c in ordered if str(c.get("id")) not in selected_ids]
    if pending:
        budget.add(lines, "CLASES:", force=True)
    detailed = 0
    for cls in pending:
        if not budget.add(lines, _class_line(cls)):
            break
        detailed += 1
    rest = pending[detailed:]
    if rest:
        truncated = True
        warnings.append(f"{len(rest)} clase(s) se resumen solo por nombre por el límite de contexto.")
        listed: list[str] = []
        for cls in rest:
            name = names.get(str(cls.get("id")), _clip(cls.get("name")))
            if not budget.fits(", ".join(listed + [name]), reserve=0):
                break
            listed.append(name)
        omitted = len(rest) - len(listed)
        note = f"Otras {len(rest)} clases (solo nombre): {', '.join(listed)}"
        if omitted:
            note += f" …y {omitted} más sin listar"
        budget.add(lines, note, force=True)

    # --- 4. Relaciones --------------------------------------------------------
    def rel_relevance(r: dict[str, Any]) -> int:
        s, t = _endpoint(r, "source"), _endpoint(r, "target")
        return 0 if (s in selected_ids or t in selected_ids) else 1 if (s in neighbors or t in neighbors) else 2

    shown_rels = 0
    sorted_rels = sorted(
        (r for r in relationships if r not in selected_rels), key=rel_relevance
    )
    if sorted_rels:
        budget.add(lines, "RELACIONES:", force=True)
    for rel in sorted_rels:
        if not budget.add(lines, _relation_line(rel, names)):
            break
        shown_rels += 1
    if shown_rels < len(sorted_rels):
        truncated = True
        omitted = len(sorted_rels) - shown_rels
        warnings.append(f"{omitted} relación(es) omitidas por el límite de contexto.")
        budget.add(lines, f"…y {omitted} relaciones más omitidas por tamaño.", force=True)

    text = "\n".join(lines)
    return ContextResult(
        text=text,
        version=version,
        source=source,
        classes=len(classes),
        relationships=len(relationships),
        approx_tokens=estimate_tokens(text),
        truncated=truncated,
        warnings=warnings,
    )
