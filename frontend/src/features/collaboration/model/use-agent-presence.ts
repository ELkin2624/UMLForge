import { useCallback, useEffect, useState } from 'react';
import {
  getAgentEnabled,
  setAgentEnabled,
  type AgentPermission,
} from '../api/agent-presence-api';

/**
 * Estado de la presencia del agente de IA en un diagrama, respaldado por el backend.
 * La presencia es común; el permiso de ejecución pertenece al usuario actual.
 */
export function useAgentPresence(diagramId: string | null, active: boolean, canManage: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<AgentPermission>('ask');
  const [loading, setLoading] = useState(false);
  const [loadedDiagramId, setLoadedDiagramId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !diagramId) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
    setLoadedDiagramId(null);
    setEnabled(false);
    setPermission('ask');
    getAgentEnabled(diagramId)
      .then((r) => {
        if (cancelled) return;
        setEnabled(r.enabled);
        setPermission(r.permission);
        setLoadedDiagramId(diagramId);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'No se pudo cargar el estado del asistente'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [active, diagramId]);

  const update = useCallback(
    async (next: boolean | AgentPermission) => {
      if (!diagramId || (typeof next === 'boolean' && !canManage)) return;
      setLoading(true);
      setError(null);
      try {
        const r = await setAgentEnabled(
          diagramId,
          typeof next === 'boolean' ? { enabled: next } : { permission: next },
        );
        setEnabled(r.enabled);
        setPermission(r.permission);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo actualizar el asistente');
      } finally {
        setLoading(false);
      }
    },
    [diagramId, canManage],
  );

  return { enabled, permission, loading, loaded: loadedDiagramId === diagramId, error, update };
}
