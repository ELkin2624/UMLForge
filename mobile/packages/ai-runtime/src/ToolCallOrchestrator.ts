import { ApiClient } from '@umlforge/api-client';
import { BaseAIDriver } from './drivers/BaseAIDriver';
import { PromptBuilder, PromptContext } from './PromptBuilder';
import { ToolRegistry } from './ToolRegistry';
import { ToolValidator } from './ToolValidator';
import { ConfirmationRequest, Message, OrchestratorResult, ToolCall, ToolDefinition } from './types';

export interface OrchestratorConfig {
  driver: BaseAIDriver;
  apiClient: ApiClient;
  toolRegistry: ToolRegistry;
  promptContext: PromptContext;
}

interface PendingExecution {
  toolCall: ToolCall;
  tool: ToolDefinition;
  sanitizedArgs: Record<string, any>;
}

export class ToolCallOrchestrator {
  private driver: BaseAIDriver;
  private apiClient: ApiClient;
  private toolRegistry: ToolRegistry;
  private validator: ToolValidator;
  private promptContext: PromptContext;
  private conversationHistory: Message[] = [];
  private pendingExecution: PendingExecution | null = null;

  constructor(config: OrchestratorConfig) {
    this.driver = config.driver;
    this.apiClient = config.apiClient;
    this.toolRegistry = config.toolRegistry;
    this.promptContext = config.promptContext;
    this.validator = new ToolValidator(this.toolRegistry);

    this.resetConversation();
  }

  resetConversation() {
    const systemPrompt = PromptBuilder.buildSystemPrompt(this.promptContext);
    this.conversationHistory = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];
    this.pendingExecution = null;
  }

  getMessages(): Message[] {
    return [...this.conversationHistory];
  }

  getPendingConfirmation(): ConfirmationRequest | null {
    if (!this.pendingExecution) return null;
    const { toolCall, tool, sanitizedArgs } = this.pendingExecution;
    return {
      toolCallId: toolCall.id,
      toolName: tool.name,
      actionType: tool.policy?.action_type || (tool.method === 'DELETE' ? 'DELETE' : 'UPDATE'),
      description: tool.description,
      arguments: sanitizedArgs,
      http: {
        method: tool.method,
        path: tool.path,
      },
    };
  }

  /**
   * Procesa el mensaje de entrada del usuario a través del ciclo completo:
   * LLM -> ToolValidator -> Policy Check (Human-In-The-Loop) -> ApiClient -> LLM -> Respuesta Final
   */
  async processUserMessage(
    userText: string,
    onProgress?: (step: string) => void
  ): Promise<OrchestratorResult> {
    this.conversationHistory.push({
      role: 'user',
      content: userText,
    });

    onProgress?.('Consultando modelo de IA local...');

    const toolsSchema = this.toolRegistry.toOpenAITools();

    // 1. Inferencia inicial del modelo
    const response = await this.driver.generateResponse(
      this.conversationHistory,
      toolsSchema
    );

    // 2. Si el modelo no solicitó herramientas, devolvemos la respuesta de texto
    if (!response.toolCalls || response.toolCalls.length === 0) {
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });
      return { content: response.content };
    }

    // 3. Evaluar cada Tool Call
    for (const toolCall of response.toolCalls) {
      onProgress?.(`Validando llamada a herramienta '${toolCall.name}'...`);

      // A. Validar con ToolValidator
      const validation = this.validator.validate(toolCall);

      if (!validation.valid) {
        onProgress?.(`Validación fallida: ${validation.error}`);
        this.conversationHistory.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify({ error: validation.error }),
        });
        continue;
      }

      const tool = validation.tool!;
      const sanitizedArgs = validation.sanitizedArgs || {};

      // B. Comprobar política de confirmación humana (Human-In-The-Loop)
      const requiresConfirmation =
        tool.policy?.requires_confirmation ||
        ['POST', 'PUT', 'DELETE'].includes(tool.method.toUpperCase());

      if (requiresConfirmation) {
        this.pendingExecution = {
          toolCall,
          tool,
          sanitizedArgs,
        };

        const confirmationPrompt =
          `⚠️ Confirmación Requerida: El asistente desea realizar la operación '${tool.name}' (${tool.description}). ` +
          `Parámetros: ${JSON.stringify(sanitizedArgs)}. ¿Deseas confirmar la ejecución?`;

        this.conversationHistory.push({
          role: 'assistant',
          content: confirmationPrompt,
        });

        return {
          content: confirmationPrompt,
          pendingConfirmation: this.getPendingConfirmation() || undefined,
        };
      }

      // C. Si es una operación de lectura (READ) segura, ejecutar directamente
      onProgress?.(`Consultando API [${tool.method} ${tool.path}]...`);
      const apiResult = await this.apiClient.executeToolCall({
        method: tool.method,
        path: tool.path,
        arguments: sanitizedArgs,
      });

      this.conversationHistory.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.name,
        content: JSON.stringify(apiResult.success ? apiResult.data : { error: apiResult.error }),
      });
    }

    // 4. Segunda inferencia del modelo con los datos obtenidos
    onProgress?.('Generando respuesta final con datos del negocio...');
    const finalResponse = await this.driver.generateResponse(
      this.conversationHistory,
      toolsSchema
    );

    const replyContent = finalResponse.content || 'Operación completada exitosamente.';

    this.conversationHistory.push({
      role: 'assistant',
      content: replyContent,
    });

    return { content: replyContent };
  }

  /**
   * Confirma y ejecuta una mutación pendiente que requería autorización humana
   */
  async confirmPendingToolCall(
    onProgress?: (step: string) => void
  ): Promise<OrchestratorResult> {
    if (!this.pendingExecution) {
      return { content: 'No hay ninguna operación pendiente de confirmación.' };
    }

    const { toolCall, tool, sanitizedArgs } = this.pendingExecution;
    this.pendingExecution = null;

    onProgress?.(`Ejecutando operación autorizada [${tool.method} ${tool.path}]...`);
    const apiResult = await this.apiClient.executeToolCall({
      method: tool.method,
      path: tool.path,
      arguments: sanitizedArgs,
    });

    this.conversationHistory.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolCall.name,
      content: JSON.stringify(
        apiResult.success
          ? { status: 'executed_by_user_confirmation', data: apiResult.data }
          : { error: apiResult.error }
      ),
    });

    onProgress?.('Generando confirmación con el modelo...');
    const toolsSchema = this.toolRegistry.toOpenAITools();
    const finalResponse = await this.driver.generateResponse(
      this.conversationHistory,
      toolsSchema
    );

    const replyContent =
      finalResponse.content ||
      `Operación '${tool.name}' ejecutada con éxito. Los datos han sido actualizados.`;

    this.conversationHistory.push({
      role: 'assistant',
      content: replyContent,
    });

    return { content: replyContent };
  }

  /**
   * Cancela la operación pendiente a petición del usuario
   */
  async cancelPendingToolCall(userReason = 'Cancelado por el usuario'): Promise<OrchestratorResult> {
    if (!this.pendingExecution) {
      return { content: 'No hay ninguna operación pendiente para cancelar.' };
    }

    const { toolCall, tool } = this.pendingExecution;
    this.pendingExecution = null;

    this.conversationHistory.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolCall.name,
      content: JSON.stringify({
        status: 'rejected_by_user',
        message: `El usuario canceló la operación '${tool.name}'. Razón: ${userReason}`,
      }),
    });

    const replyContent = `Operación '${tool.name}' cancelada. No se modificó ningún dato en el sistema.`;
    this.conversationHistory.push({
      role: 'assistant',
      content: replyContent,
    });

    return { content: replyContent };
  }
}
