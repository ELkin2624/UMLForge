import * as Y from 'yjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UMLModel } from '../../../types/canonical-model';
import { useModelStore } from '../../../store/model-store';
import { useShareStore } from '../../sharing/model/share-store';
import { useCommandHistory } from '../../uml-commands';
import { getModelJson, setModelJson } from '../../collaboration';
import type { AIPatch } from '../types';
import { captureBase } from './patch-to-commands';
import { useAIAssistantStore } from './ai-store';

vi.mock('../api/ai-api', () => ({
  collaborateWithAI: vi.fn(),
  fetchPrivateHistory: vi.fn(),
  clearPrivateHistory: vi.fn(),
  fetchAuditFeed: vi.fn().mockResolvedValue([]),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

const base = (): UMLModel => ({
  classes: [
    { id: 'u', name: 'Usuario', attributes: [], operations: [] },
    { id: 'p', name: 'Pedido', attributes: [], operations: [] },
  ],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
});

const mkPatch = (over: Partial<AIPatch>, against: UMLModel): AIPatch => {
  const p: AIPatch = {
    patch_id: `p-${Math.random().toString(36).slice(2, 7)}`,
    operation: 'ADD_CLASS',
    target: 'Producto',
    data: {},
    reason: 'test',
    requested_by: 'ana',
    status: 'pending_approval',
    ...over,
  };
  return { ...p, base: captureBase(against, p) };
};

function setup(model: UMLModel) {
  const ydoc = new Y.Doc();
  setModelJson(ydoc, JSON.stringify(model), 'seed');
  useModelStore.setState({ model: structuredClone(model) });
  useShareStore.setState({ localRole: 'EDITOR' });
  useCommandHistory.getState().reset();
  const ySuggestions = ydoc.getMap<AIPatch>('ai_suggestions');
  const sync = () => useAIAssistantStore.setState({ suggestions: ySuggestions.toJSON() });
  ySuggestions.observe(sync);
  useAIAssistantStore.setState({ suggestions: {}, error: null });
  const add = (p: AIPatch) => {
    ySuggestions.set(p.patch_id, p);
    sync();
  };
  return { ydoc, ySuggestions, add };
}

const names = (ydoc: Y.Doc) => (JSON.parse(getModelJson(ydoc) ?? '{}') as UMLModel).classes.map((c) => c.name);

describe('approvePatches con Yjs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('escribe el modelo y retira la sugerencia en el Y.Doc, y queda deshacible', async () => {
    const { ydoc, ySuggestions, add } = setup(base());
    const p = mkPatch({ target: 'Producto' }, base());
    add(p);

    await useAIAssistantStore.getState().approvePatch({ diagramId: '7', patchId: p.patch_id, userName: 'x', ydoc });

    expect(names(ydoc)).toEqual(['Usuario', 'Pedido', 'Producto']);
    expect(ySuggestions.has(p.patch_id)).toBe(false);
    expect(useModelStore.getState().model?.classes).toHaveLength(3);
    expect(useCommandHistory.getState().undoStack).toHaveLength(1);
  });

  it('lee el estado del Y.Doc, no el del store: no pisa un cambio remoto ya recibido', async () => {
    const { ydoc, add } = setup(base());
    const p = mkPatch({ target: 'Producto' }, base());
    add(p);

    // Otra persona añadió "Factura" en la sala; el store local aún no se ha enterado.
    const remote = base();
    remote.classes.push({ id: 'f', name: 'Factura', attributes: [], operations: [] });
    setModelJson(ydoc, JSON.stringify(remote), 'remote-peer');

    await useAIAssistantStore.getState().approvePatch({ diagramId: '7', patchId: p.patch_id, userName: 'x', ydoc });

    expect(names(ydoc)).toEqual(['Usuario', 'Pedido', 'Factura', 'Producto']);
  });

  it('si otra persona tocó el elemento, la sugerencia queda "stale" y el diagrama intacto', async () => {
    const { ydoc, ySuggestions, add } = setup(base());
    const p = mkPatch({ operation: 'DELETE_CLASS', target: 'Pedido' }, base());
    add(p);

    const remote = base();
    remote.classes[1].attributes.push({ id: 'z', name: 'total', type: 'double', visibility: 'private' });
    setModelJson(ydoc, JSON.stringify(remote), 'remote-peer');

    await useAIAssistantStore.getState().approvePatch({ diagramId: '7', patchId: p.patch_id, userName: 'x', ydoc });

    expect(names(ydoc)).toEqual(['Usuario', 'Pedido']); // no se borró nada
    expect(ySuggestions.get(p.patch_id)?.status).toBe('stale');
    expect(useAIAssistantStore.getState().error).toMatch(/obsoleta/);
    expect(useCommandHistory.getState().undoStack).toHaveLength(0);

    // una sugerencia obsoleta ya no se puede aprobar
    await useAIAssistantStore.getState().approvePatch({ diagramId: '7', patchId: p.patch_id, userName: 'x', ydoc });
    expect(names(ydoc)).toEqual(['Usuario', 'Pedido']);
  });

  it('aprobar todas es un lote atómico y se deshace de una vez', async () => {
    const { ydoc, ySuggestions, add } = setup(base());
    add(mkPatch({ target: 'Producto' }, base()));
    add(mkPatch({ target: 'Factura' }, base()));

    await useAIAssistantStore.getState().approveAll({ diagramId: '7', ydoc });
    expect(names(ydoc)).toEqual(['Usuario', 'Pedido', 'Producto', 'Factura']);
    expect(ySuggestions.size).toBe(0);
    expect(useCommandHistory.getState().undoStack).toHaveLength(1);

    expect(useCommandHistory.getState().undo('7')).toBe(true);
    expect(useModelStore.getState().model?.classes.map((c) => c.name)).toEqual(['Usuario', 'Pedido']);
  });

  it('un lote con un parche inválido no aplica ninguno y no retira las sugerencias', async () => {
    const { ydoc, ySuggestions, add } = setup(base());
    add(mkPatch({ target: 'Producto' }, base()));
    add(mkPatch({ operation: 'ADD_RELATION', target: '', data: { source: 'Producto', target: 'NoExiste' } }, base()));

    await useAIAssistantStore.getState().approveAll({ diagramId: '7', ydoc });
    expect(names(ydoc)).toEqual(['Usuario', 'Pedido']);
    expect(ySuggestions.size).toBe(2);
    expect(useAIAssistantStore.getState().error).toMatch(/NoExiste/);
  });

  it('un lector no puede aprobar', async () => {
    const { ydoc, add } = setup(base());
    const p = mkPatch({ target: 'Producto' }, base());
    add(p);
    useShareStore.setState({ localRole: 'READER' });
    await useAIAssistantStore.getState().approvePatch({ diagramId: '7', patchId: p.patch_id, userName: 'x', ydoc });
    expect(names(ydoc)).toEqual(['Usuario', 'Pedido']);
    expect(useAIAssistantStore.getState().error).toMatch(/solo lectura/);
  });

  it('dos clientes sincronizados convergen tras aprobar en uno', async () => {
    const { ydoc, add } = setup(base());
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(ydoc));
    ydoc.on('update', (u: Uint8Array) => Y.applyUpdate(peer, u));

    const p = mkPatch({ target: 'Producto' }, base());
    add(p);
    await useAIAssistantStore.getState().approvePatch({ diagramId: '7', patchId: p.patch_id, userName: 'x', ydoc });

    expect(names(peer)).toEqual(['Usuario', 'Pedido', 'Producto']);
    expect(peer.getMap('ai_suggestions').has(p.patch_id)).toBe(false);
  });
});
