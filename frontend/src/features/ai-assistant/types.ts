export interface CanvasPatchOperation {
  op: 'ADD_CLASS' | 'UPDATE_CLASS' | 'DELETE_CLASS' | 'ADD_RELATION' | 'DELETE_RELATION';
  target_name: string;
  payload: Record<string, any>;
  reason: string;
}

export interface AIPatch {
  patch_id: string;
  operation: 'ADD_CLASS' | 'UPDATE_CLASS' | 'DELETE_CLASS' | 'ADD_RELATION' | 'DELETE_RELATION';
  target: string;
  data: Record<string, any>;
  reason: string;
  requested_by: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  timestamp?: string | number;
}

export interface AIPresenceState {
  status: 'idle' | 'observing' | 'thinking' | 'editing_canvas';
  consultingWith: string | null;
  color: string;
  timestamp: number;
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

export interface CollaborateResponse {
  reply: string;
  patches: AIPatch[];
  execution_mode: 'DIRECT' | 'SUGGESTION';
  shared_decision_note?: string;
}
