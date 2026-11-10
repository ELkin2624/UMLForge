import type { UMLModel } from './canonical-model';

export interface DiagramSummary {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  my_role: string | null;
}

export interface DiagramDetail extends DiagramSummary {
  data: UMLModel;
  version: number;
}

export interface VersionAuthor {
  type: 'user' | 'ai';
  user_id: number | null;
  name: string;
  on_behalf_of?: { user_id: number | null; name: string } | null;
}

export interface VersionChange {
  op: 'added' | 'removed' | 'modified';
  kind: string;
  id: string;
  name: string;
  parent: string | null;
  detail: string | null;
}

export interface VersionSummary {
  diagram_id: number;
  version: number;
  author: VersionAuthor;
  source: 'user' | 'ai' | 'restore' | 'import' | 'migration';
  created_at: string;
  summary: string;
  changes: VersionChange[];
  restored_from: number | null;
}

export interface VersionDetail extends VersionSummary {
  data: UMLModel;
}

export interface ValidationError {
  model_element_id?: string;
  field: string;
  message: string;
  type?: string;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
}

export interface AIPatch {
  patch_id: string;
  operation: 'ADD_CLASS' | 'UPDATE_CLASS' | 'DELETE_CLASS' | 'ADD_RELATION' | 'DELETE_RELATION';
  target: string;
  data: Record<string, unknown>;
  reason: string;
  requested_by: string;
  status: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  patches?: AIPatch[];
  timestamp?: string;
  simulated?: boolean;
}

export interface CollaborateResponse {
  reply: string;
  patches: AIPatch[];
  execution_mode: 'DIRECT' | 'SUGGESTION';
  shared_decision_note?: string | null;
  simulated: boolean;
}

export interface AuditLogEntry {
  diagram_id: string;
  actor: string;
  action_summary: string;
  timestamp: string;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}
