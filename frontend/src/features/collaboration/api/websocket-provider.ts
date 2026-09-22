import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { Awareness } from 'y-protocols/awareness';
import type { ICollaborationProvider } from './provider';
import { useAuthStore } from '../../auth/store';

/**
 * Implementación de ICollaborationProvider usando y-websocket.
 * URL del servidor: VITE_YJS_WS_URL (default ws://localhost:1234).
 */
export class YWebSocketProvider implements ICollaborationProvider {
  private readonly _provider: WebsocketProvider;

  constructor(doc: Y.Doc, roomName: string) {
    const wsUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_YJS_WS_URL) ||
      'ws://localhost:1234';

    const token = useAuthStore.getState().token;

    // connect: false → no conectar inmediatamente; se llama connect() explícitamente
    this._provider = new WebsocketProvider(wsUrl, roomName, doc, {
      connect: false,
      params: { token: token || '' },
    });
  }

  connect(): void {
    this._provider.connect();
  }

  disconnect(): void {
    this._provider.disconnect();
  }

  destroy(): void {
    this._provider.destroy();
  }

  getAwareness(): Awareness {
    return this._provider.awareness;
  }

  /**
   * El evento 'sync' de WebsocketProvider emite `true` cuando el Y.Doc
   * ha recibido el estado completo del servidor.
   */
  onSync(callback: (isSynced: boolean) => void): () => void {
    if (this._provider.synced) {
      callback(true);
    }
    this._provider.on('sync', callback);
    return () => this._provider.off('sync', callback);
  }

  /**
   * El evento 'status' de y-websocket emite { status: 'connecting' | 'connected' | 'disconnected' }.
   */
  onStatus(callback: (status: { status: 'connected' | 'disconnected' }) => void): () => void {
    const handler = (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
      if (event.status === 'connecting') return;
      callback({ status: event.status });
    };
    this._provider.on('status', handler);
    return () => this._provider.off('status', handler);
  }

  get doc(): Y.Doc {
    return this._provider.doc;
  }
}
