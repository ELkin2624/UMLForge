export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface Message {
  role: Role;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolParameterSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

export interface ToolHttpConfig {
  method: string;
  path: string;
}

export interface ToolPermissions {
  required: string;
}

export interface ToolPolicy {
  action_type: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';
  requires_confirmation: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  method: string;
  path: string;
  required_permission: string;
  http?: ToolHttpConfig;
  permissions?: ToolPermissions;
  policy?: ToolPolicy;
  parameters: ToolParameterSchema;
}

export interface ToolsManifest {
  schema_version: string;
  project_name: string;
  domain: string;
  tools: ToolDefinition[];
}

export interface ModelInfo {
  id: string;
  displayName: string;
  sizeBytes: number;
  sizeMB: number;
  format: 'gguf';
  quantization: string;
  recommended: boolean;
  downloadUrl?: string;
}

export interface InstalledModelInfo extends ModelInfo {
  localPath: string;
  installedAt: string;
  verified: boolean;
}

export type DriverType = 'llama-native' | 'ollama-http' | 'mock';

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export interface ConfirmationRequest {
  toolCallId: string;
  toolName: string;
  actionType: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';
  description: string;
  arguments: Record<string, any>;
  http: { method: string; path: string };
}

export interface OrchestratorResult {
  content: string;
  pendingConfirmation?: ConfirmationRequest;
}
