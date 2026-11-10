export interface CanvasPatchOperation {
  op: 'ADD_CLASS' | 'UPDATE_CLASS' | 'DELETE_CLASS' | 'ADD_RELATION' | 'UPDATE_RELATION' | 'DELETE_RELATION';
  target_name: string;
  payload: Record<string, any>;
  reason: string;
}

import type { AIPatch } from '../../../../packages/uml-commands/patch-types.ts';
export type { AIPatch };

export interface AIPresenceState {
  status: 'idle' | 'observing' | 'thinking' | 'editing_canvas';
  consultingWith: string | null;
  color: string;
  timestamp: number;
  targetId?: string;
  expiresAt?: number;
}

export interface AuditLogEntry {
  diagram_id: string;
  actor: string;
  action_summary: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  image?: string;
  patches?: AIPatch[];
  timestamp?: string;
}

/** Metadatos del contexto que el backend usó para responder. */
export interface ContextInfo {
  source: 'server' | 'client';
  version: number;
  classes: number;
  relationships: number;
  approx_tokens: number;
  truncated: boolean;
  warnings: string[];
}

export interface CollaborateResponse {
  reply: string;
  patches: AIPatch[];
  execution_mode: 'DIRECT' | 'SUGGESTION';
  shared_decision_note?: string;
  /** true si la respuesta no vino del modelo real (modo de respaldo sin conexión). */
  simulated?: boolean;
  context?: ContextInfo;
  permission?: 'ask' | 'safe' | 'full';
  allow_delete?: boolean;
}
