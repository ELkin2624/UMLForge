import { BaseAIDriver } from './BaseAIDriver';
import { LLMResponse, Message, ToolCall } from '../types';

export class LlamaNativeDriver extends BaseAIDriver {
  readonly name = 'llama-native';
  private llamaContext: any = null;
  private modelPath: string;

  constructor(modelPath: string) {
    super();
    this.modelPath = modelPath;
  }

  async initialize(): Promise<void> {
    try {
      // Import dinámico de llama.rn para evitar errores en entornos no nativos (ej. Node o Web)
      // @ts-ignore
      const llamaModule = await import('llama.rn');
      const { initLlama } = llamaModule;

      this.llamaContext = await initLlama({
        model: this.modelPath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 0, // Ajustable según hardware móvil
      });
    } catch (err: any) {
      console.warn('[LlamaNativeDriver] No se pudo inicializar llama.rn:', err.message);
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.llamaContext !== null;
  }

  async generateResponse(
    messages: Message[],
    tools: any[]
  ): Promise<LLMResponse> {
    if (!this.llamaContext) {
      return {
        content: '[LlamaNativeDriver] El contexto nativo no está inicializado. Se requiere un Development Build.',
      };
    }

    try {
      // Formatear mensajes con herramientas para el motor llama.rn
      const formattedPrompt = this.formatMessagesWithTools(messages, tools);

      const result = await this.llamaContext.completion({
        prompt: formattedPrompt,
        n_predict: 256,
        temperature: 0.2,
      });

      const responseText = result.text || '';
      const toolCalls = this.extractToolCalls(responseText);

      return {
        content: toolCalls.length > 0 ? '' : responseText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (err: any) {
      return {
        content: `[LlamaNativeDriver Error]: ${err.message}`,
      };
    }
  }

  private formatMessagesWithTools(messages: Message[], tools: any[]): string {
    let prompt = '<|im_start|>system\n';
    const sysMsg = messages.find((m) => m.role === 'system');
    prompt += sysMsg?.content || 'Eres un asistente útil con herramientas.';
    if (tools && tools.length > 0) {
      prompt += '\n\nHerramientas disponibles en formato JSON:\n' + JSON.stringify(tools);
    }
    prompt += '<|im_end|>\n';

    for (const m of messages) {
      if (m.role === 'system') continue;
      prompt += `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`;
    }
    prompt += '<|im_start|>assistant\n';
    return prompt;
  }

  private extractToolCalls(text: string): ToolCall[] {
    const calls: ToolCall[] = [];
    try {
      // Detectar bloque JSON de llamada a herramienta
      const jsonMatch = text.match(/\{[\s\S]*"name"\s*:\s*"([a-zA-Z0-9_]+)"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.name) {
          calls.push({
            id: `call_${Date.now()}`,
            name: parsed.name,
            arguments: parsed.arguments || parsed.parameters || {},
          });
        }
      }
    } catch {
      // Si no es JSON válido, continúa como texto normal
    }
    return calls;
  }
}
