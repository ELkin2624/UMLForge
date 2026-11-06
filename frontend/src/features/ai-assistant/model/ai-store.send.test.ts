import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UMLModel } from '../../../types/canonical-model';
import { useModelStore } from '../../../store/model-store';
import { collaborateWithAI } from '../api/ai-api';
import { flushPendingSave } from '../../versioning';
import { useAIAssistantStore } from './ai-store';

vi.mock('../api/ai-api', () => ({
  collaborateWithAI: vi.fn(),
  fetchPrivateHistory: vi.fn(),
  clearPrivateHistory: vi.fn(),
  fetchAuditFeed: vi.fn().mockResolvedValue([]),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../versioning', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../versioning')>()),
  flushPendingSave: vi.fn().mockResolvedValue(undefined),
}));

const model = (): UMLModel => ({
  classes: [{ id: 'u', name: 'Usuario', attributes: [], operations: [] }],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
});

const response = (over = {}) => ({
  reply: 'ok',
  patches: [],
  execution_mode: 'SUGGESTION' as const,
  ...over,
});

const send = () =>
  useAIAssistantStore
    .getState()
    .sendMessage({ diagramId: '7', userId: '1', userName: 'Ana', prompt: 'mejora esto', ydoc: null });

describe('sendMessage: contexto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useModelStore.setState({ model: model(), selectedNodeId: null });
    useAIAssistantStore.setState({ isThinking: false, error: null });
  });

  it('guarda lo pendiente ANTES de preguntar y envía la selección', async () => {
    const order: string[] = [];
    vi.mocked(flushPendingSave).mockImplementation(async () => void order.push('flush'));
    vi.mocked(collaborateWithAI).mockImplementation(async () => {
      order.push('ask');
      return response();
    });
    useModelStore.setState({ selectedNodeId: 'u' });

    await send();

    expect(order).toEqual(['flush', 'ask']);
    expect(vi.mocked(collaborateWithAI).mock.calls[0][0]).toMatchObject({ diagramId: '7', selection: ['u'] });
  });

  it('sin selección envía una lista vacía', async () => {
    vi.mocked(collaborateWithAI).mockResolvedValue(response());
    await send();
    expect(vi.mocked(collaborateWithAI).mock.calls[0][0].selection).toEqual([]);
  });

  it('avisa en el chat cuando el contexto se recortó', async () => {
    vi.mocked(collaborateWithAI).mockResolvedValue(
      response({
        context: {
          source: 'server', version: 3, classes: 150, relationships: 10,
          approx_tokens: 2900, truncated: true, warnings: [],
        },
      }),
    );
    await send();
    const last = useAIAssistantStore.getState().privateHistory.at(-1);
    expect(last?.role).toBe('system');
    expect(last?.content).toMatch(/150 clases/);
  });

  it('no avisa si el contexto fue completo', async () => {
    vi.mocked(collaborateWithAI).mockResolvedValue(
      response({
        context: { source: 'server', version: 3, classes: 5, relationships: 1, approx_tokens: 200, truncated: false, warnings: [] },
      }),
    );
    await send();
    const roles = useAIAssistantStore.getState().privateHistory.map((m) => m.role);
    expect(roles.at(-1)).toBe('model');
  });
});
