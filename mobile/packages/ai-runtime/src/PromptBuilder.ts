import { ToolDefinition } from './types';

export interface PromptContext {
  projectName: string;
  domain: string;
  systemPromptOverride?: string;
  tools: ToolDefinition[];
}

export class PromptBuilder {
  static buildSystemPrompt(context: PromptContext): string {
    if (context.systemPromptOverride) {
      return context.systemPromptOverride;
    }

    const toolSummaries = context.tools
      .map((t) => `- ${t.name}: ${t.description} [${t.method} ${t.path}]`)
      .join('\n');

    return `Eres el asistente inteligente de la app ${context.projectName} (Dominio: ${context.domain}).
Tu misión es atender consultas del usuario sobre el negocio de manera clara, concisa y veraz.

Tienes disponibles las siguientes herramientas del sistema:
${toolSummaries}

Instrucciones de Tool Calling:
- Si el usuario pregunta por citas, catálogo, clientes o datos del negocio, debes generar una llamada a herramienta (tool call).
- Espera el resultado de los datos reales del negocio antes de responder.
- Formula tu respuesta final en español, con tono profesional y cordial.`;
  }
}
