import { useCallback, useEffect, useState } from 'react';
import { getAgentEnabled, setAgentEnabled } from '../api/agent-presence-api';

/**
 * Estado de la presencia del agente de IA en un diagrama, respaldado por el backend.
 * Solo el propietario puede leerlo o cambiarlo.
 */
export function useAgentPresence(diagramId: string | null, active: boolean, canManage: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !canManage || !diagramId) return;
    let cancelled = false;
    setError(null);
    getAgentEnabled(diagramId)
      .then((r) => !cancelled && setEnabled(r.enabled))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'No se pudo cargar el estado del asistente'));
    return () => {
      cancelled = true;
    };
  }, [active, canManage, diagramId]);

  const update = useCallback(
    async (next: boolean) => {
      if (!diagramId) return;
      setLoading(true);
      setError(null);
      try {
        const r = await setAgentEnabled(diagramId, next);
        setEnabled(r.enabled);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo actualizar el asistente');
      } finally {
        setLoading(false);
      }
    },
    [diagramId],
  );

  return { enabled, loading, error, update };
}
