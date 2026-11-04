import type { DiagramSummary } from '../../../api/diagrams-api';
import type { UMLModel } from '../../../types/canonical-model';
import type { Role } from '../../sharing/model/types';

export type DiagramFilter = 'all' | 'own' | 'shared';

/** Normaliza el rol que devuelve el backend; lo desconocido se trata como lector. */
export function toRole(value: string | null | undefined): Role {
  return value === 'OWNER' || value === 'EDITOR' ? value : 'READER';
}

/** ¿El modelo trae algo dibujado? (mismo criterio que usa el editor al cargar). */
export function hasContent(data: Partial<UMLModel> | null | undefined): data is UMLModel {
  return Boolean(data && (data.classes?.length || data.components?.length));
}

/** Modelo canónico vacío con id propio, para que el editor lo trate como un diagrama nuevo. */
export function emptyModel(name: string): UMLModel {
  return {
    id: crypto.randomUUID(),
    name,
    classes: [],
    relationships: [],
    components: [],
    interfaces: [],
    diagrams: [],
  };
}

/** Filtra por texto y por propiedad; el más recientemente modificado primero. */
export function filterDiagrams(
  diagrams: DiagramSummary[],
  query: string,
  filter: DiagramFilter,
  currentUserId: number | undefined
): DiagramSummary[] {
  const q = query.trim().toLowerCase();
  return diagrams
    .filter((d) => !q || d.name.toLowerCase().includes(q))
    .filter((d) => {
      if (filter === 'own') return d.owner_id === currentUserId;
      if (filter === 'shared') return d.owner_id !== currentUserId;
      return true;
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
