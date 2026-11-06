import { request } from '../../../api/client';
import { useAuthStore } from '../../auth/store';

/** URL HTTP del servidor de colaboración (derivada de VITE_YJS_WS_URL, default ws://localhost:1234). */
function collabHttpUrl(): string {
  const wsUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_YJS_WS_URL) ||
    'ws://localhost:1234';
  return wsUrl.replace(/^ws/, 'http').replace(/\/$/, '');
}

/** Estado de la presencia del agente de IA en el diagrama (solo propietario). */
export function getAgentEnabled(diagramId: string): Promise<{ enabled: boolean }> {
  return request<{ enabled: boolean }>(`/diagrams/${diagramId}/agent`);
}

/**
 * Activa o desactiva al agente en el backend (fuente de verdad) y luego avisa al servidor
 * de colaboración para que lo muestre u oculte en la sala al instante. El aviso es
 * "best effort": si el servidor no responde, el estado se aplicará en la próxima conexión.
 */
export async function setAgentEnabled(
  diagramId: string,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  const result = await request<{ enabled: boolean }>(`/diagrams/${diagramId}/agent`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
  try {
    await fetch(`${collabHttpUrl()}/agent/${diagramId}/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore.getState().token || ''}` },
    });
  } catch {
    // servidor de colaboración caído: no es un error de la activación
  }
  return result;
}
