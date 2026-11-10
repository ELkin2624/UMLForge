"""Orquesta el análisis de diseño de datos: modelo lógico + normalización."""

from pydantic import ValidationError

from app.core.canonical_model.model import UMLModel

from .inference import (
    Suggestion,
    dependency_id,
    first_normal_form_issues,
    infer_dependencies,
)
from .logical import build_logical_model
from .normalization import (
    FD,
    Check,
    candidate_keys,
    check_2nf,
    check_3nf,
    check_bcnf,
    closure,
    fmt,
    normal_form,
    prime_attributes,
    synthesize_3nf,
)
from .schemas import (
    DataDesignResult,
    DecomposedRelation,
    DecompositionResult,
    DependencyDecision,
    FunctionalDependency,
    LogicalTable,
    NormalizationCheck,
    NormalizationSummary,
    TableNormalization,
)


class InvalidModelForDesign(Exception):
    """El modelo recibido no se pudo interpretar."""


def _fd(lhs: list[str] | tuple[str, ...], rhs: list[str] | tuple[str, ...]) -> FD:
    return (frozenset(lhs), frozenset(rhs))


def _evaluate(
    table: LogicalTable,
    fds: list[FD],
    first_nf_high: list[str],
) -> tuple[list[frozenset[str]], bool, list[Check], str]:
    attributes = frozenset(c.name for c in table.columns)
    keys, exact = candidate_keys(attributes, fds)
    checks = [
        Check(
            "1FN",
            not first_nf_high,
            "Todos los atributos son atómicos (un solo valor por celda)."
            if not first_nf_high
            else "Hay atributos multivaluados.",
            first_nf_high,
        ),
        check_2nf(attributes, fds, keys),
        check_3nf(attributes, fds, keys),
        check_bcnf(attributes, fds),
    ]
    return keys, exact, checks, normal_form(checks)


def _analyze_table(
    table: LogicalTable,
    tables: list[LogicalTable],
    decisions: list[DependencyDecision],
    issues: list[tuple[str, str, str]],
) -> TableNormalization:
    attributes = [c.name for c in table.columns]
    attr_set = set(attributes)
    warnings: list[str] = [msg for _, sev, msg in issues if sev == "low"]
    first_nf_high = [msg for _, sev, msg in issues if sev == "high"]

    dependencies: list[FunctionalDependency] = []
    confirmed: list[FD] = []
    pending: list[FD] = []

    # 1. Dependencias de clave: PK -> resto de atributos (siempre).
    others = [a for a in attributes if a not in table.primary_key]
    if table.primary_key and others:
        dependencies.append(FunctionalDependency(
            id=dependency_id(table.name, table.primary_key, others),
            lhs=list(table.primary_key), rhs=others, source="key", status="confirmed",
            reason="La clave primaria determina todos los demás atributos.",
        ))
        confirmed.append(_fd(table.primary_key, others))

    mine = [d for d in decisions if d.table == table.name]
    by_id = {dependency_id(d.table, d.lhs, d.rhs): d for d in mine}

    # 2. Sugerencias inferidas, con la decisión del usuario si existe.
    suggestions: list[Suggestion] = infer_dependencies(table, tables)
    seen_ids: set[str] = set()
    for s in suggestions:
        seen_ids.add(s.id)
        decision = by_id.get(s.id)
        status = "suggested"
        if decision and decision.status in ("accepted", "custom"):
            status = "confirmed"
        elif decision and decision.status == "rejected":
            status = "rejected"
        dependencies.append(FunctionalDependency(
            id=s.id, lhs=list(s.lhs), rhs=list(s.rhs), source="inferred",
            status=status, reason=s.reason, rule=s.rule, confidence=s.confidence,  # type: ignore[arg-type]
        ))
        if status == "confirmed":
            confirmed.append(_fd(s.lhs, s.rhs))
        elif status == "suggested":
            pending.append(_fd(s.lhs, s.rhs))

    # 3. Dependencias escritas por el usuario (o aceptadas cuya sugerencia ya no existe).
    for d in mine:
        did = dependency_id(d.table, d.lhs, d.rhs)
        if did in seen_ids or d.status == "rejected":
            continue
        unknown = (set(d.lhs) | set(d.rhs)) - attr_set
        if unknown:
            warnings.append(
                f"La dependencia {', '.join(d.lhs)} → {', '.join(d.rhs)} se ignora: "
                f"no existen las columnas {', '.join(sorted(unknown))}."
            )
            continue
        dependencies.append(FunctionalDependency(
            id=did, lhs=list(d.lhs), rhs=list(d.rhs), source="custom", status="confirmed",
            reason="Dependencia declarada por el usuario.",
        ))
        confirmed.append(_fd(d.lhs, d.rhs))

    keys, exact, checks, nf = _evaluate(table, confirmed, first_nf_high)
    _, _, _, nf_with = _evaluate(table, confirmed + pending, first_nf_high)

    if not exact:
        warnings.append(
            "La tabla tiene demasiados atributos para enumerar todas las claves "
            "candidatas; el resultado puede ser incompleto."
        )

    # Demostración.
    all_attrs = frozenset(attributes)
    proof: list[str] = []
    for key in keys:
        proof.append(f"{fmt(key)}⁺ = {fmt(closure(key, confirmed))} → clave candidata")
    prime = prime_attributes(keys)
    proof.append(f"Atributos primos (forman parte de alguna clave): {fmt(prime) if prime else '(ninguno)'}")
    proof.append(f"Atributos no primos: {fmt(all_attrs - prime) if all_attrs - prime else '(ninguno)'}")

    decomposition: DecompositionResult | None = None
    failing_2_3 = [c for c in checks if c.form in ("2FN", "3FN") and not c.ok]
    if failing_2_3 and keys:
        d = synthesize_3nf(table.name, all_attrs, confirmed, keys, list(table.primary_key))
        decomposition = DecompositionResult(
            steps=d.steps,
            relations=[
                DecomposedRelation(name=r.name, attributes=r.attributes,
                                   primary_key=r.primary_key, fds=r.fds)
                for r in d.relations
            ],
            lossless=d.lossless,
            preserves_dependencies=d.preserves_dependencies,
            explanation=d.explanation,
        )

    return TableNormalization(
        table=table.name,
        attributes=attributes,
        primary_key=list(table.primary_key),
        dependencies=dependencies,
        candidate_keys=[sorted(k) for k in keys],
        keys_exact=exact,
        prime_attributes=sorted(prime),
        checks=[NormalizationCheck(form=c.form, ok=c.ok, detail=c.detail, evidence=c.evidence)
                for c in checks],
        normal_form=nf,
        normal_form_if_suggestions_accepted=nf_with,
        pending_suggestions=len(pending),
        proof=proof,
        decomposition=decomposition,
        warnings=warnings,
    )


def analyze(model_data: dict, decisions: list[DependencyDecision]) -> DataDesignResult:
    try:
        model = UMLModel.model_validate(model_data)
    except ValidationError as exc:
        raise InvalidModelForDesign(
            "El modelo no es válido: " + "; ".join(e["msg"] for e in exc.errors()[:3])
        ) from exc

    try:
        logical, entities = build_logical_model(model)
    except Exception as exc:  # modelos a medio construir pueden fallar en el mapeo
        raise InvalidModelForDesign(f"No se pudo derivar el modelo lógico: {exc}") from exc

    table_by_class = {e.class_name: e.table_name for e in entities}
    issues = first_normal_form_issues(model, table_by_class)

    results = [
        _analyze_table(t, logical.tables, decisions, issues.get(t.name, []))
        for t in logical.tables
    ]

    by_form: dict[str, int] = {}
    for r in results:
        by_form[r.normal_form] = by_form.get(r.normal_form, 0) + 1
    summary = NormalizationSummary(
        tables=len(results),
        by_form=by_form,
        all_in_3nf=all(r.normal_form in ("3FN", "FNBC") for r in results),
        pending_suggestions=sum(r.pending_suggestions for r in results),
    )
    return DataDesignResult(logical=logical, normalization=results, summary=summary)
