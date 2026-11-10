import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';

// Proveedor falso: nunca conecta (simula un servidor caído).
const fake = vi.hoisted(() => ({
  instances: [] as Array<{
    connect: ReturnType<typeof vi.fn>;
    emitStatus: (s: 'connected' | 'disconnected') => void;
    emitSync: (v: boolean) => void;
    emitClose: (code: number) => void;
    disconnect: ReturnType<typeof vi.fn>;
    getAwareness: () => unknown;
  }>,
}));

vi.mock('../api/websocket-provider', async () => {
  const { Awareness } = await import('y-protocols/awareness');
  class YWebSocketProvider {
    doc: Y.Doc;
    private awareness: InstanceType<typeof Awareness>;
    private statusCb: ((s: { status: 'connected' | 'disconnected' }) => void) | null = null;
    private syncCb: ((v: boolean) => void) | null = null;
    private closeCb: ((i: { code: number; reason: string }) => void) | null = null;
    connect = vi.fn();
    disconnect = vi.fn();
    constructor(doc: Y.Doc) {
      this.doc = doc;
      this.awareness = new Awareness(doc);
      fake.instances.push({
        connect: this.connect,
        emitStatus: (status) => this.statusCb?.({ status }),
        emitSync: (v) => this.syncCb?.(v),
        emitClose: (code) => this.closeCb?.({ code, reason: '' }),
        disconnect: this.disconnect,
        getAwareness: () => this.awareness,
      });
    }
    getAwareness() { return this.awareness; }
    onStatus(cb: (s: { status: 'connected' | 'disconnected' }) => void) { this.statusCb = cb; return () => { this.statusCb = null; }; }
    onSync(cb: (v: boolean) => void) { this.syncCb = cb; return () => { this.syncCb = null; }; }
    onClose(cb: (i: { code: number; reason: string }) => void) { this.closeCb = cb; return () => { this.closeCb = null; }; }
    destroy() {}
  }
  return { YWebSocketProvider };
});

import {
  CollaborationManager, CONNECT_TIMEOUT_MS, CONNECT_ERROR_MESSAGE,
  CLOSE_FORBIDDEN, CLOSE_UNAUTHORIZED, FORBIDDEN_MESSAGE,
} from './collaboration-manager';
import { useModelStore } from '../../../store/model-store';

const collab = () => useModelStore.getState().collaboration;

describe('CollaborationManager · conexión', () => {
  let manager: CollaborationManager;

  beforeEach(() => {
    vi.useFakeTimers();
    fake.instances.length = 0;
    useModelStore.getState().resetCollaboration();
    manager = new CollaborationManager();
  });

  afterEach(() => {
    manager.disconnect();
    vi.useRealTimers();
  });

  it('muestra "connecting" mientras espera y "error" si el servidor no responde', () => {
    manager.connect('1');
    expect(collab().status).toBe('connecting');

    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS - 1);
    expect(collab().status).toBe('connecting');

    vi.advanceTimersByTime(1);
    expect(collab().status).toBe('error');
    expect(collab().error).toBe(CONNECT_ERROR_MESSAGE);
  });

  it('si el servidor aparece después del error, sincroniza y limpia el error', () => {
    manager.connect('1');
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS);
    expect(collab().status).toBe('error');

    fake.instances[0].emitSync(true);
    expect(collab().status).toBe('synced');
    expect(collab().error).toBeNull();
  });

  it('no muestra error si sincroniza a tiempo', () => {
    manager.connect('1');
    fake.instances[0].emitStatus('connected');
    fake.instances[0].emitSync(true);
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS * 2);
    expect(collab().status).toBe('synced');
    expect(collab().error).toBeNull();
  });

  it('desconectar cancela el aviso de error pendiente', () => {
    manager.connect('1');
    manager.disconnect();
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS * 2);
    expect(collab().status).not.toBe('error');
  });

  it('connect a la misma sala es idempotente: no recrea el documento ni el clientID', () => {
    manager.connect('1', 'Alan');
    const awareness = fake.instances[0].getAwareness() as { clientID: number };
    const clientId = awareness.clientID;

    manager.connect('1', 'Alan');
    manager.connect('1');
    expect(fake.instances).toHaveLength(1);
    expect(fake.instances[0].connect).toHaveBeenCalledTimes(1);
    expect((fake.instances[0].getAwareness() as { clientID: number }).clientID).toBe(clientId);
  });

  it('envía solo las posiciones modificadas al recibir cambios remotos', () => {
    manager.connect('1');
    fake.instances[0].emitSync(true);
    const received = vi.fn();
    manager.subscribeToVisualState(received);
    const doc = manager.getDoc()!;
    const positions = doc.getMap<{ x: number; y: number }>('visual-state');

    doc.transact(() => {
      positions.set('a', { x: 10, y: 20 });
      positions.set('b', { x: 30, y: 40 });
    }, 'remote');
    expect(received).toHaveBeenLastCalledWith({ a: { x: 10, y: 20 }, b: { x: 30, y: 40 } });

    positions.set('b', { x: 35, y: 40 });
    expect(received).toHaveBeenLastCalledWith({ b: { x: 35, y: 40 } });
  });

  it('actualizar el nombre en una reconexión idempotente lo refleja en la presencia', () => {
    manager.connect('1', 'Alan');
    manager.connect('1', 'Alan Melgar');
    const aw = fake.instances[0].getAwareness() as { getLocalState: () => { user: { name: string } } };
    expect(aw.getLocalState().user.name).toBe('Alan Melgar');
  });

  it('connect a otra sala sí crea una conexión nueva', () => {
    manager.connect('1');
    manager.connect('2');
    expect(fake.instances).toHaveLength(2);
    expect(collab().roomName).toBe('2');
  });

  it('volver a conectar tras desconectar crea una conexión nueva', () => {
    manager.connect('1');
    manager.disconnect();
    manager.connect('1');
    expect(fake.instances).toHaveLength(2);
  });

  it('un rechazo por permisos (4003) muestra el motivo y detiene los reintentos', () => {
    manager.connect('1');
    fake.instances[0].emitClose(CLOSE_FORBIDDEN);
    expect(collab().status).toBe('error');
    expect(collab().error).toBe(FORBIDDEN_MESSAGE);
    expect(fake.instances[0].disconnect).toHaveBeenCalled();

    // el aviso genérico de timeout no lo pisa
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS * 2);
    expect(collab().error).toBe(FORBIDDEN_MESSAGE);
  });

  it('un token vencido (4001) no es definitivo: sigue reintentando sin marcar permisos', () => {
    manager.connect('1');
    fake.instances[0].emitClose(CLOSE_UNAUTHORIZED);
    expect(collab().error).not.toBe(FORBIDDEN_MESSAGE);
    expect(fake.instances[0].disconnect).not.toHaveBeenCalled();
  });
});
