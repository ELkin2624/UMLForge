import { request } from '../../../api/client';
import { CollaborateResponse, AuditLogEntry, ChatMessage } from '../types';

export async function collaborateWithAI(params: {
  diagramId: string;
  userId: string;
  userName: string;
  prompt: string;
  imageBase64?: string;
  currentCanvasSnapshot: Record<string, any>;
}): Promise<CollaborateResponse> {
  return request<CollaborateResponse>('/ai/collaborate', {
    method: 'POST',
    body: JSON.stringify({
      diagram_id: params.diagramId,
      user_id: params.userId,
      user_name: params.userName,
      prompt: params.prompt,
      image_base64: params.imageBase64,
      current_canvas_snapshot: params.currentCanvasSnapshot,
    }),
  });
}

export async function fetchPrivateHistory(diagramId: string, userId: string): Promise<ChatMessage[]> {
  const url = `/ai/history/${encodeURIComponent(diagramId)}?user_id=${encodeURIComponent(userId)}`;
  const rawList = await request<any[]>(url);
  return rawList.map((item, index) => ({
    id: item.id || `msg-${index}-${Date.now()}`,
    role: item.role,
    content: item.content,
    patches: item.patches || [],
    timestamp: item.timestamp,
  }));
}

export async function clearPrivateHistory(diagramId: string, userId: string): Promise<void> {
  await request(`/ai/history/${encodeURIComponent(diagramId)}?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function fetchAuditFeed(diagramId: string): Promise<AuditLogEntry[]> {
  return request<AuditLogEntry[]>(`/ai/audit-feed/${encodeURIComponent(diagramId)}`);
}

export async function logAuditEvent(diagramId: string, actor: string, actionSummary: string): Promise<void> {
  await request(`/ai/audit-feed/${encodeURIComponent(diagramId)}`, {
    method: 'POST',
    body: JSON.stringify({
      actor,
      action_summary: actionSummary,
    }),
  });
}

export async function fetchSharedMemory(diagramId: string): Promise<{ diagram_id: string; architectural_decisions: any[] }> {
  return request(`/ai/shared-memory/${encodeURIComponent(diagramId)}`);
}
