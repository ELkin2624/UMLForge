import { BaseAIDriver } from './BaseAIDriver';
import { LLMResponse, Message, ToolCall } from '../types';

export class OllamaHttpDriver extends BaseAIDriver {
  readonly name = 'ollama-http';
  private baseUrl: string;
  private modelName: string;

  constructor(config?: { baseUrl?: string; modelName?: string }) {
    super();
    this.baseUrl = (config?.baseUrl || 'http://10.0.2.2:11434').replace(/\/$/, '');
    this.modelName = config?.modelName || 'qwen2.5:0.5b';
  }

  async initialize(): Promise<void> {
    // No requiere precarga en cliente
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async generateResponse(
    messages: Message[],
    tools: any[]
  ): Promise<LLMResponse> {
    try {
      const formattedMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: formattedMessages,
          tools: tools && tools.length > 0 ? tools : undefined,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const message = data?.message;
      const toolCalls: ToolCall[] = [];

      if (message?.tool_calls && Array.isArray(message.tool_calls)) {
        for (const tc of message.tool_calls) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || {},
          });
        }
      }

      return {
        content: message?.content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (err: any) {
      return {
        content: `[Ollama Error] No se pudo conectar a ${this.baseUrl}: ${err.message}`,
      };
    }
  }
}
