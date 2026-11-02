import { useCallback, useEffect, useState } from 'react';
import {
  getShareLink,
  regenerateShareLink,
  updateShareLink,
  type LinkRole,
  type ShareLink,
} from '../api/share-link-api';

const DEFAULT_LINK: ShareLink = { enabled: false, role: 'EDITOR', token: null };

/**
 * Estado del enlace "cualquiera con el enlace" de un diagrama, respaldado por el backend.
 * Solo el propietario puede leerlo o cambiarlo (el token es secreto).
 */
export function useShareLink(diagramId: string | null, active: boolean, canManage: boolean) {
  const [link, setLink] = useState<ShareLink>(DEFAULT_LINK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !canManage || !diagramId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getShareLink(diagramId)
      .then((l) => !cancelled && setLink(l))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'No se pudo cargar el enlace'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [active, canManage, diagramId]);

  const run = useCallback(async (action: () => Promise<ShareLink>) => {
    setLoading(true);
    setError(null);
    try {
      setLink(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el enlace');
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(
    (enabled: boolean, role: LinkRole) =>
      diagramId ? run(() => updateShareLink(diagramId, { enabled, role })) : Promise.resolve(),
    [diagramId, run]
  );

  const regenerate = useCallback(
    () => (diagramId ? run(() => regenerateShareLink(diagramId)) : Promise.resolve()),
    [diagramId, run]
  );

  return { link, loading, error, update, regenerate };
}
