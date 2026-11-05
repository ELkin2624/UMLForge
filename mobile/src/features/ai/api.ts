import { request } from '@/shared/api/client';
import type { AuditLogEntry, ChatMessage, CollaborateResponse } from '@/types/api';

/** Pregunta a la IA. El snapshot es solo contexto: el móvil nunca aplica los parches devueltos. */
export function askAI(params: {
  diagramId: string;
  userId: string;
  userName: string;
  prompt: string;
  snapshot: Record<string, unknown>;
}) {
  return request<CollaborateResponse>('/ai/collaborate', {
    method: 'POST',
    body: JSON.stringify({
      diagram_id: params.diagramId,
      user_id: params.userId,
      user_name: params.userName,
      prompt: params.prompt,
      current_canvas_snapshot: params.snapshot,
    }),
  });
}

export async function fetchPrivateHistory(diagramId: string, userId: string): Promise<ChatMessage[]> {
  const raw = await request<ChatMessage[]>(
    `/ai/history/${encodeURIComponent(diagramId)}?user_id=${encodeURIComponent(userId)}`
  );
  return raw.map((m, i) => ({ ...m, id: m.id ?? `msg-${i}`, patches: m.patches ?? [] }));
}

export const fetchAuditFeed = (diagramId: string) =>
  request<AuditLogEntry[]>(`/ai/audit-feed/${encodeURIComponent(diagramId)}`);

export const fetchSharedMemory = (diagramId: string) =>
  request<{ diagram_id: string; architectural_decisions: SharedDecision[] }>(
    `/ai/shared-memory/${encodeURIComponent(diagramId)}`
  );

export interface SharedDecision {
  decision?: string;
  note?: string;
  author?: string;
  user_name?: string;
  timestamp?: string;
  [key: string]: unknown;
}
