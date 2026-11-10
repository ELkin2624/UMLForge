import { useEffect, useState } from 'react';
import { listVersions, type DiagramSummary } from '../../../api/diagrams-api';
import { getShareLink, type ShareLink } from '../../sharing/api/share-link-api';
import { listCollaborators, type DiagramCollaborator } from '../api/collaborators-api';

export interface DiagramInsights {
  loaded: boolean;
  /** Número de la versión actual (null si aún no hay historial). */
  version: number | null;
  lastAuthor: string | null;
  lastSummary: string | null;
  /** Solo el propietario puede ver el enlace de acceso. */
  link: ShareLink | null;
  members: DiagramCollaborator[];
}

const EMPTY: DiagramInsights = {
  loaded: false, version: null, lastAuthor: null, lastSummary: null, link: null, members: [],
};

/**
 * Datos de una tarjeta: última versión, enlace de acceso y colaboradores.
 * Cada consulta falla por separado (un error en una no oculta las demás).
 * `refreshKey` fuerza recargar, p. ej. al cerrar los diálogos de Compartir o Historial.
 */
export function useDiagramInsights(diagram: DiagramSummary, isOwner: boolean, refreshKey: number) {
  const [data, setData] = useState<DiagramInsights>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const id = diagram.id;
    void Promise.allSettled([
      listVersions(String(id), { limit: 1 }),
      isOwner ? getShareLink(String(id)) : Promise.resolve(null),
      isOwner ? listCollaborators(id) : Promise.resolve([] as DiagramCollaborator[]),
    ]).then(([versions, link, members]) => {
      if (cancelled) return;
      const last = versions.status === 'fulfilled' ? versions.value[0] : undefined;
      setData({
        loaded: true,
        version: last?.version ?? null,
        lastAuthor: last ? (last.author.type === 'ai' ? 'IA' : last.author.name) : null,
        lastSummary: last?.summary ?? null,
        link: link.status === 'fulfilled' ? link.value : null,
        members: members.status === 'fulfilled' ? members.value : [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [diagram.id, diagram.updated_at, isOwner, refreshKey]);

  return data;
}
