from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Entrada ───────────────────────────────────────────────────────────────────


class DependencyDecision(BaseModel):
    """Decisión del usuario sobre una dependencia funcional de una tabla."""

    table: str
    lhs: list[str] = Field(min_length=1)
    rhs: list[str] = Field(min_length=1)
    # accepted/rejected: sobre una sugerencia; custom: dependencia escrita por el usuario.
    status: Literal["accepted", "rejected", "custom"]


class AnalyzeRequest(BaseModel):
    model_data: dict[str, Any]
    dependencies: list[DependencyDecision] = Field(default_factory=list)


class DependenciesPayload(BaseModel):
    dependencies: list[DependencyDecision] = Field(default_factory=list)


# ── Modelo lógico ─────────────────────────────────────────────────────────────


class LogicalColumn(BaseModel):
    name: str
    sql_type: str
    is_pk: bool = False
    is_fk: bool = False
    nullable: bool = True
    references: str | None = None  # "tabla.columna"


class LogicalForeignKey(BaseModel):
    columns: list[str]
    ref_table: str
    ref_columns: list[str]
    on_delete: str | None = None


class LogicalTable(BaseModel):
    name: str
    class_name: str | None = None
    kind: Literal["entity", "join"] = "entity"
    columns: list[LogicalColumn]
    primary_key: list[str]
    foreign_keys: list[LogicalForeignKey] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class LogicalEdge(BaseModel):
    id: str
    from_table: str
    to_table: str
    columns: list[str]
    cardinality: Literal["N:1", "1:1"]
    label: str | None = None


class MappingRule(BaseModel):
    """Cómo un elemento conceptual (clase/relación) pasó al modelo lógico."""

    element: str
    kind: Literal["class", "relationship", "inheritance"]
    result: str
    rule: str


class LogicalModel(BaseModel):
    tables: list[LogicalTable]
    edges: list[LogicalEdge]
    mappings: list[MappingRule]


# ── Normalización ─────────────────────────────────────────────────────────────


class FunctionalDependency(BaseModel):
    id: str
    lhs: list[str]
    rhs: list[str]
    source: Literal["key", "inferred", "custom"]
    status: Literal["confirmed", "suggested", "rejected"]
    reason: str
    rule: str | None = None
    confidence: Literal["high", "medium", "low"] = "high"


class NormalizationCheck(BaseModel):
    form: str
    ok: bool
    detail: str
    evidence: list[str] = Field(default_factory=list)


class DecomposedRelation(BaseModel):
    name: str
    attributes: list[str]
    primary_key: list[str]
    fds: list[str]


class DecompositionResult(BaseModel):
    steps: list[str]
    relations: list[DecomposedRelation]
    lossless: bool
    preserves_dependencies: bool
    explanation: str


class TableNormalization(BaseModel):
    table: str
    attributes: list[str]
    primary_key: list[str]
    dependencies: list[FunctionalDependency]
    candidate_keys: list[list[str]]
    keys_exact: bool = True
    prime_attributes: list[str]
    checks: list[NormalizationCheck]
    normal_form: str
    # Resultado si se aceptaran las sugerencias pendientes.
    normal_form_if_suggestions_accepted: str
    pending_suggestions: int = 0
    proof: list[str] = Field(default_factory=list)
    decomposition: DecompositionResult | None = None
    warnings: list[str] = Field(default_factory=list)


class NormalizationSummary(BaseModel):
    tables: int
    by_form: dict[str, int]
    all_in_3nf: bool
    pending_suggestions: int


class DataDesignResult(BaseModel):
    logical: LogicalModel
    normalization: list[TableNormalization]
    summary: NormalizationSummary
