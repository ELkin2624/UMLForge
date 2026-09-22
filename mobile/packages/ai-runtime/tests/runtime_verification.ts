import { ToolRegistry } from '../src/ToolRegistry';
import { ToolValidator } from '../src/ToolValidator';
import { ToolCallOrchestrator } from '../src/ToolCallOrchestrator';
import { MockDriver } from '../src/drivers/MockDriver';
import { ModelManager } from '../src/ModelManager';
import { ToolDefinition } from '../src/types';

declare const process: any;

const assert = {
  strictEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      throw new Error(message || `Assertion failed: expected ${expected}, got ${actual}`);
    }
  },
  ok(value: any, message?: string) {
    if (!value) {
      throw new Error(message || `Assertion failed: truthy value expected, got ${value}`);
    }
  },
};

async function runTests() {
  console.log('=== TEST 1: ToolRegistry & ToolValidator ===');

  const registry = new ToolRegistry();
  const sampleTools: ToolDefinition[] = [
    {
      name: 'list_cortes',
      description: 'Obtiene el catálogo de cortes',
      method: 'GET',
      path: '/api/cortes',
      required_permission: 'READ_CORTE',
      policy: {
        action_type: 'READ',
        requires_confirmation: false,
      },
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer' },
        },
        required: [],
      },
    },
    {
      name: 'delete_cita',
      description: 'Elimina una cita por ID',
      method: 'DELETE',
      path: '/api/citas/{id}',
      required_permission: 'DELETE_CITA',
      policy: {
        action_type: 'DELETE',
        requires_confirmation: true,
      },
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
        },
        required: ['id'],
      },
    },
  ];

  registry.registerTools(sampleTools);
  assert.strictEqual(registry.hasTool('list_cortes'), true);
  assert.strictEqual(registry.hasTool('delete_cita'), true);
  assert.strictEqual(registry.hasTool('non_existent'), false);

  const validator = new ToolValidator(registry);

  // 1.1 Valid call to list_cortes
  const validList = validator.validate({
    id: 'call_1',
    name: 'list_cortes',
    arguments: { limit: '10' },
  });
  assert.strictEqual(validList.valid, true);
  assert.strictEqual(validList.sanitizedArgs?.limit, 10);

  // 1.2 Invalid call to delete_cita (missing id)
  const invalidDelete = validator.validate({
    id: 'call_2',
    name: 'delete_cita',
    arguments: {},
  });
  assert.strictEqual(invalidDelete.valid, false);
  assert.ok(invalidDelete.error?.includes('id'));

  console.log('✓ ToolRegistry y ToolValidator pasaron todas las aserciones');

  console.log('\n=== TEST 2: ModelManager Real & Registry ===');
  const availableModels = ModelManager.getAvailableModels();
  assert.ok(availableModels.length >= 3);
  assert.strictEqual(availableModels[0].id, 'qwen2.5-0.5b-instruct');
  assert.strictEqual(availableModels[0].sizeMB, 491);

  const localPath = ModelManager.getModelLocalPath('qwen2.5-0.5b-instruct');
  assert.ok(localPath.includes('qwen2.5-0.5b-instruct-q4_k_m.gguf'));

  const verification = await ModelManager.verifyModel('qwen2.5-0.5b-instruct');
  // Archivo no existe aún en disco -> verified debe ser false y no explotar
  assert.strictEqual(verification.verified, false);
  console.log('✓ ModelManager verifica existencia real de archivos GGUF');

  console.log('\n=== TEST 3: ToolCallOrchestrator End-to-End con Human-In-The-Loop ===');

  let deleteCalled = false;
  const mockApiClient: any = {
    async executeToolCall(tool: any) {
      if (tool.path === '/api/cortes') {
        return {
          success: true,
          data: [
            { id: 1, nombre: 'Corte Clásico', precio: 12.0 },
            { id: 2, nombre: 'Degradado Fade', precio: 15.0 },
          ],
        };
      }
      if ((tool.path === '/api/citas/32' || tool.path === '/api/citas/{id}') && tool.arguments?.id === 32 && tool.method === 'DELETE') {
        deleteCalled = true;
        return { success: true, data: { deletedId: 32 } };
      }
      return { success: false, error: 'Endpoint no encontrado' };
    },
  };

  const orchestrator = new ToolCallOrchestrator({
    driver: new MockDriver(),
    apiClient: mockApiClient,
    toolRegistry: registry,
    promptContext: {
      projectName: 'Barbería Elkin',
      domain: 'barberia',
      tools: sampleTools,
    },
  });

  // 3.1 Consulta de lectura (READ -> auto ejecutada)
  const readRes = await orchestrator.processUserMessage('¿Qué cortes tienen disponibles?');
  assert.ok(readRes.content.includes('Corte Clásico'));
  assert.strictEqual(readRes.pendingConfirmation, undefined);
  console.log('✓ Operación de lectura ejecutada automáticamente sin fricción');

  // 3.2 Intento de DELETE -> Debe requerir confirmación humana explícita
  // Simulamos que el driver emite un tool call para borrar la cita 32
  const customDriver: any = {
    async generateResponse() {
      return {
        content: '',
        toolCalls: [{ id: 'del_32', name: 'delete_cita', arguments: { id: 32 } }],
      };
    },
  };

  const secureOrchestrator = new ToolCallOrchestrator({
    driver: customDriver,
    apiClient: mockApiClient,
    toolRegistry: registry,
    promptContext: {
      projectName: 'Barbería Elkin',
      domain: 'barberia',
      tools: sampleTools,
    },
  });

  const mutationRes = await secureOrchestrator.processUserMessage('Elimina la cita 32');
  assert.ok(mutationRes.pendingConfirmation !== undefined);
  assert.strictEqual(mutationRes.pendingConfirmation?.actionType, 'DELETE');
  assert.strictEqual(mutationRes.pendingConfirmation?.arguments.id, 32);
  assert.strictEqual(deleteCalled, false); // NUNCA se debe haber llamado todavía al backend!
  console.log('✓ Mutación DELETE detenida para confirmación humana (Human-In-The-Loop)');

  // 3.3 El usuario confirma la acción
  const confirmRes = await secureOrchestrator.confirmPendingToolCall();
  assert.strictEqual(deleteCalled, true); // Ahora sí se ejecutó contra el API
  assert.ok(confirmRes.content.includes('delete_cita'));
  console.log('✓ Mutación ejecutada solo tras confirmación humana explícita');

  console.log('\n=== TODOS LOS TESTS PASARON EXITOSAMENTE ===');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
