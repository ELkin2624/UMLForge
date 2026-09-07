import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollaborationManager } from '../../src/collaboration/collaboration-manager';
import { useModelStore } from '../../src/store/model-store';

/**
 * Tests del CollaborationManager usando mocks de YWebSocketProvider.
 *
 * Estrategia: mockeamos el módulo websocket-provider para aislar la lógica
 * del manager sin depender de un servidor WebSocket real.
 */

// Mock del proveedor WebSocket
const createMockProvider = () => {
  const syncListeners: ((isSynced: boolean) => void)[] = [];
  const statusListeners: ((s: { status: 'connected' | 'disconnected' }) => void)[] = [];

  const provider = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    destroy: vi.fn(),
    getAwareness: vi.fn(() => ({
      setLocalState: vi.fn(),
      setLocalStateField: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getStates: vi.fn(() => new Map()),
    })),
    onSync: vi.fn((cb: (isSynced: boolean) => void) => {
      syncListeners.push(cb);
      return () => syncListeners.splice(syncListeners.indexOf(cb), 1);
    }),
    onStatus: vi.fn((cb: (s: { status: 'connected' | 'disconnected' }) => void) => {
      statusListeners.push(cb);
      return () => statusListeners.splice(statusListeners.indexOf(cb), 1);
    }),
    doc: null as unknown, // será asignado por el manager

    // Helpers de test
    _triggerSync: (isSynced: boolean) => syncListeners.forEach((cb) => cb(isSynced)),
    _triggerStatus: (status: 'connected' | 'disconnected') =>
      statusListeners.forEach((cb) => cb({ status })),
  };

  return provider;
};

// Mockear el módulo websocket-provider
vi.mock('../../src/collaboration/websocket-provider', () => {
  let currentMock: ReturnType<typeof createMockProvider> | null = null;

  const YWebSocketProvider = vi.fn().mockImplementation(function (
    this: unknown,
    doc: unknown
  ) {
    currentMock = createMockProvider();
    (currentMock as ReturnType<typeof createMockProvider>).doc = doc;
    return currentMock;
  }) as unknown as { _currentMock: ReturnType<typeof createMockProvider> | null };

  (YWebSocketProvider as unknown as { _currentMock: ReturnType<typeof createMockProvider> | null })._currentMock = null;

  return { YWebSocketProvider };
});

// Mockear sessionStorage para awareness
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('sessionStorage', storageMock);

describe('CollaborationManager', () => {
  beforeEach(() => {
    storageMock.clear();
    useModelStore.getState().setModel(null);
    useModelStore.getState().resetCollaboration();
  });

  it('connect() actualiza el estado del store a "connecting"', async () => {
    const manager = new CollaborationManager();
    manager.connect('test-room', 'Tester');
    expect(useModelStore.getState().collaboration.status).toBe('connecting');
    manager.disconnect();
  });

  it('después de disconnect(), el estado es "idle"', () => {
    const manager = new CollaborationManager();
    manager.connect('test-room');
    manager.disconnect();
    expect(useModelStore.getState().collaboration.status).toBe('idle');
  });

  it('se puede llamar connect/disconnect/connect sin crashear', () => {
    const manager = new CollaborationManager();
    expect(() => {
      manager.connect('room-1');
      manager.disconnect();
      manager.connect('room-2');
      manager.disconnect();
    }).not.toThrow();
  });

  it('disconnect() es idempotente (varias llamadas no crashean)', () => {
    const manager = new CollaborationManager();
    manager.connect('room');
    expect(() => {
      manager.disconnect();
      manager.disconnect();
      manager.disconnect();
    }).not.toThrow();
  });

  it('resetCollaboration limpia roomNameWarning', () => {
    useModelStore.getState().setRoomNameWarning('Aviso de prueba');
    useModelStore.getState().resetCollaboration();
    expect(useModelStore.getState().roomNameWarning).toBeNull();
  });

  it('estado de colaboración tiene valores por defecto correctos al resetear', () => {
    useModelStore.getState().setCollaborationStatus('synced');
    useModelStore.getState().resetCollaboration();
    const collab = useModelStore.getState().collaboration;
    expect(collab.status).toBe('idle');
    expect(collab.roomName).toBeNull();
    expect(collab.peersCount).toBe(0);
    expect(collab.peers).toHaveLength(0);
    expect(collab.error).toBeNull();
  });
});
