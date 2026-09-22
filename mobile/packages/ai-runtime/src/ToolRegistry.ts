import { ToolDefinition } from './types';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  registerTools(tools: ToolDefinition[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  clear() {
    this.tools.clear();
  }

  /**
   * Convierte las herramientas al formato estándar de OpenAI / Llama.cpp function calling
   */
  toOpenAITools(): any[] {
    return this.getAllTools().map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
}
