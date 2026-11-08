import { request } from '../../../api/client';
import { CollaborateResponse, AuditLogEntry, ChatMessage } from '../types';

export async function collaborateWithAI(params: {
  diagramId: string;
  prompt: string;
  imageBase64?: string;
  currentCanvasSnapshot: Record<string, any>;
  /** Ids de los elementos seleccionados en el lienzo. */
  selection?: string[];
}): Promise<CollaborateResponse> {
  return request<CollaborateResponse>('/ai/collaborate', {
    method: 'POST',
    body: JSON.stringify({
      diagram_id: Number(params.diagramId),
      prompt: params.prompt,
      image_base64: params.imageBase64,
      current_canvas_snapshot: params.currentCanvasSnapshot,
      selection: params.selection ?? [],
    }),
  });
}

export async function fetchPrivateHistory(diagramId: string): Promise<ChatMessage[]> {
  const url = `/ai/history/${encodeURIComponent(diagramId)}`;
  const rawList = await request<any[]>(url);
  return rawList.map((item, index) => ({
    id: item.id || `msg-${index}-${Date.now()}`,
    role: item.role,
    content: item.content,
    patches: item.patches || [],
    timestamp: item.timestamp,
  }));
}

export async function clearPrivateHistory(diagramId: string): Promise<void> {
  await request(`/ai/history/${encodeURIComponent(diagramId)}`, {
    method: 'DELETE',
  });
}

export async function fetchAuditFeed(diagramId: string): Promise<AuditLogEntry[]> {
  return request<AuditLogEntry[]>(`/ai/audit-feed/${encodeURIComponent(diagramId)}`);
}

/** El autor lo fija el backend a partir del token. */
export async function logAuditEvent(diagramId: string, actionSummary: string): Promise<void> {
  await request(`/ai/audit-feed/${encodeURIComponent(diagramId)}`, {
    method: 'POST',
    body: JSON.stringify({
      action_summary: actionSummary,
    }),
  });
}

export async function fetchSharedMemory(diagramId: string): Promise<{ diagram_id: string; architectural_decisions: any[] }> {
  return request(`/ai/shared-memory/${encodeURIComponent(diagramId)}`);
}
