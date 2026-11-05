import { request } from '@/shared/api/client';
import type { UMLModel } from '@/types/canonical-model';

// ── Tipos (espejo de backend/app/modules/data_design/schemas.py) ─────────────

export type DecisionStatus = 'accepted' | 'rejected' | 'custom';

/** Decisión del usuario sobre una dependencia funcional de una tabla. */
export interface DependencyDecision {
  table: string;
  lhs: string[];
  rhs: string[];
  status: DecisionStatus;
}

export interface LogicalColumn {
  name: string;
  sql_type: string;
  is_pk: boolean;
  is_fk: boolean;
  nullable: boolean;
  references: string | null;
}

export interface LogicalForeignKey {
  columns: string[];
  ref_table: string;
  ref_columns: string[];
  on_delete: string | null;
}

export interface LogicalTable {
  name: string;
  class_name: string | null;
  kind: 'entity' | 'join';
  columns: LogicalColumn[];
  primary_key: string[];
  foreign_keys: LogicalForeignKey[];
  notes: string[];
}

export interface LogicalEdge {
  id: string;
  from_table: string;
  to_table: string;
  columns: string[];
  cardinality: 'N:1' | '1:1';
  label: string | null;
}

export interface MappingRule {
  element: string;
  kind: 'class' | 'relationship' | 'inheritance';
  result: string;
  rule: string;
}

export interface LogicalModel {
  tables: LogicalTable[];
  edges: LogicalEdge[];
  mappings: MappingRule[];
}

export interface FunctionalDependency {
  id: string;
  lhs: string[];
  rhs: string[];
  source: 'key' | 'inferred' | 'custom';
  status: 'confirmed' | 'suggested' | 'rejected';
  reason: string;
  rule: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface NormalizationCheck {
  form: string;
  ok: boolean;
  detail: string;
  evidence: string[];
}

export interface DecomposedRelation {
  name: string;
  attributes: string[];
  primary_key: string[];
  fds: string[];
}

export interface DecompositionResult {
  steps: string[];
  relations: DecomposedRelation[];
  lossless: boolean;
  preserves_dependencies: boolean;
  explanation: string;
}

export interface TableNormalization {
  table: string;
  attributes: string[];
  primary_key: string[];
  dependencies: FunctionalDependency[];
  candidate_keys: string[][];
  keys_exact: boolean;
  prime_attributes: string[];
  checks: NormalizationCheck[];
  normal_form: string;
  normal_form_if_suggestions_accepted: string;
  pending_suggestions: number;
  proof: string[];
  decomposition: DecompositionResult | null;
  warnings: string[];
}

export interface NormalizationSummary {
  tables: number;
  by_form: Record<string, number>;
  all_in_3nf: boolean;
  pending_suggestions: number;
}

export interface DataDesignResult {
  logical: LogicalModel;
  normalization: TableNormalization[];
  summary: NormalizationSummary;
}

// ── Llamadas ─────────────────────────────────────────────────────────────────

/** Modelo lógico + normalización del modelo actual (aunque aún no esté guardado). */
export function analyzeDataDesign(
  model: UMLModel,
  dependencies: DependencyDecision[]
): Promise<DataDesignResult> {
  return request<DataDesignResult>('/data-design/analyze', {
    method: 'POST',
    body: JSON.stringify({ model_data: model, dependencies }),
  });
}

/** Solo lectura: el móvil nunca guarda decisiones (PUT) sobre dependencias. */
export function getDependencyDecisions(roomId: string): Promise<DependencyDecision[]> {
  return request<DependencyDecision[]>(`/diagrams/${roomId}/data-design/dependencies`);
}
