import type { DependencyDecision, DecisionStatus } from '../api/data-design-api';

/** Clave estable de una dependencia (misma que genera el backend). */
export function dependencyKey(table: string, lhs: string[], rhs: string[]): string {
  return `${table}:${[...lhs].sort().join(',')}->${[...rhs].sort().join(',')}`;
}

/** Agrega o reemplaza la decisión sobre una dependencia (inmutable). */
export function upsertDecision(
  decisions: DependencyDecision[],
  table: string,
  lhs: string[],
  rhs: string[],
  status: DecisionStatus
): DependencyDecision[] {
  const key = dependencyKey(table, lhs, rhs);
  const rest = decisions.filter((d) => dependencyKey(d.table, d.lhs, d.rhs) !== key);
  return [...rest, { table, lhs: [...lhs], rhs: [...rhs], status }];
}

/** Quita la decisión (la dependencia vuelve a ser una sugerencia pendiente). */
export function removeDecision(
  decisions: DependencyDecision[],
  table: string,
  lhs: string[],
  rhs: string[]
): DependencyDecision[] {
  const key = dependencyKey(table, lhs, rhs);
  return decisions.filter((d) => dependencyKey(d.table, d.lhs, d.rhs) !== key);
}
