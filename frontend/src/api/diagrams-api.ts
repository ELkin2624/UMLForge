import { request } from './client';
import { UMLModel } from '../types/canonical-model';

/** Origen de un guardado: "ai" cuando lo originan parches aplicados por la IA. */
export type SaveSource = 'user' | 'ai';

/** Respuesta de guardar/restaurar un diagrama. */
export interface DiagramSaveResult {
  id: number;
  name: string;
  data: UMLModel;
  /** Número de la versión actual del diagrama. */
  version: number;
  /** true si el guardado creó una versión nueva; false si no había diferencias. */
  version_created: boolean | null;
  my_role: string | null;
}

export interface VersionAuthor {
  type: 'user' | 'ai';
  user_id: number | null;
  name: string;
  /** Solo para type "ai": quién le pidió el cambio. */
  on_behalf_of?: { user_id: number | null; name: string } | null;
}

export interface VersionChange {
  op: 'added' | 'removed' | 'modified';
  kind: string;
  id: string;
  name: string;
  parent: string | null;
  detail: string | null;
}

export interface VersionSummary {
  diagram_id: number;
  version: number;
  author: VersionAuthor;
  source: 'user' | 'ai' | 'restore' | 'import' | 'migration';
  created_at: string;
  summary: string;
  changes: VersionChange[];
  restored_from: number | null;
}

export interface VersionDetail extends VersionSummary {
  data: UMLModel;
}

/**
 * Guarda el modelo canónico del diagrama en el backend (NoSQL) y, si hubo
 * cambios, registra una versión nueva a nombre del usuario autenticado.
 */
export async function saveDiagram(
  roomId: string,
  model: UMLModel,
  source: SaveSource = 'user'
): Promise<DiagramSaveResult> {
  return request<DiagramSaveResult>(`/diagrams/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify({ data: model, source }),
  });
}

/** Historial del diagrama, de la versión más nueva a la más antigua. */
export async function listVersions(
  roomId: string,
  opts: { limit?: number; before?: number } = {}
): Promise<VersionSummary[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.before) params.set('before', String(opts.before));
  const qs = params.toString();
  return request<VersionSummary[]>(`/diagrams/${roomId}/versions${qs ? `?${qs}` : ''}`);
}

/** Una versión con su snapshot completo (para visualizarla). */
export async function getVersion(roomId: string, version: number): Promise<VersionDetail> {
  return request<VersionDetail>(`/diagrams/${roomId}/versions/${version}`);
}

/** Restaura una versión como versión nueva (no borra el historial). */
export async function restoreVersion(
  roomId: string,
  version: number
): Promise<DiagramSaveResult> {
  return request<DiagramSaveResult>(`/diagrams/${roomId}/versions/${version}/restore`, {
    method: 'POST',
  });
}

/** Fila del listado de diagramas del usuario (propios y compartidos). */
export interface DiagramSummary {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  my_role: string | null;
}

/** Diagramas a los que el usuario tiene acceso, con su rol en cada uno. */
export async function listDiagrams(): Promise<DiagramSummary[]> {
  return request<DiagramSummary[]>('/diagrams');
}

/** Un diagrama con su modelo canónico completo. */
export async function getDiagram(id: number | string): Promise<DiagramSaveResult> {
  return request<DiagramSaveResult>(`/diagrams/${id}`);
}

/** Crea un diagrama; el usuario queda como OWNER. */
export async function createDiagram(
  name: string,
  data: UMLModel | Record<string, never> = {}
): Promise<DiagramSaveResult> {
  return request<DiagramSaveResult>('/diagrams', {
    method: 'POST',
    body: JSON.stringify({ name, data }),
  });
}

/** Cambia solo el nombre (requiere rol EDITOR u OWNER). */
export async function renameDiagram(id: number | string, name: string): Promise<DiagramSaveResult> {
  return request<DiagramSaveResult>(`/diagrams/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

/** Elimina el diagrama y su historial (solo OWNER). */
export async function deleteDiagram(id: number | string): Promise<void> {
  await request<void>(`/diagrams/${id}`, { method: 'DELETE' });
}
