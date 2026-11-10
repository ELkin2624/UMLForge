import { request } from '../../../api/client';
import { useAuthStore } from '../../auth/store';

export type AgentPermission = 'ask' | 'safe' | 'full';
export interface AgentSettings {
  enabled: boolean;
  permission: AgentPermission;
}

/** URL HTTP del servidor de colaboración (derivada de VITE_YJS_WS_URL). */
function collabHttpUrl(): string {
  const wsUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_YJS_WS_URL) ||
    'ws://localhost:1234';
  return wsUrl.replace(/^ws/, 'http').replace(/\/$/, '');
}

/** Presencia común y preferencia personal de IA del usuario autenticado. */
export function getAgentEnabled(diagramId: string): Promise<AgentSettings> {
  return request<AgentSettings>(`/diagrams/${diagramId}/agent`);
}

/** Guarda la preferencia personal o la presencia común; solo esta última refresca Yjs. */
export async function setAgentEnabled(
  diagramId: string,
  settings: Partial<AgentSettings>,
): Promise<AgentSettings> {
  const result = await request<AgentSettings>(`/diagrams/${diagramId}/agent`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  if (settings.enabled !== undefined) {
    try {
      await fetch(`${collabHttpUrl()}/agent/${diagramId}/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${useAuthStore.getState().token || ''}` },
      });
    } catch {
      // La presencia se actualizará cuando el servidor Yjs vuelva a estar disponible.
    }
  }
  return result;
}
