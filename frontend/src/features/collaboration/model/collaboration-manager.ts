import * as Y from 'yjs';
import { YWebSocketProvider } from '../api/websocket-provider';
import { createYjsDocument, getModelJson, setModelJson } from './yjs-document';
import { setupAwareness, getOrCreateLocalIdentity } from './awareness';
import { bindYjsToStore } from './yjs-bindings';
import { useModelStore } from '../../../store/model-store';
import type { CollaborationStatus, PeerInfo } from './types';

/**
 * CollaborationManager — orquesta Y.Doc, WebsocketProvider, Awareness y Bindings.
 *
 * Ciclo de vida diseñado para ser REUTILIZABLE:
 *   connect() → disconnect() → connect() → disconnect() ...
 *
 * Garantías:
 * - Todos los listeners se limpian antes de destruir recursos.
 * - No quedan conexiones WebSocket ni observers huérfanos tras disconnect().
 * - La lógica de autoridad del documento se evalúa ÚNICAMENTE en el evento 'sync'
 *   (isSynced=true), nunca antes (para no asumir sala vacía durante la sincronización).
 * - Solo expone estado de UI; Y.Doc, provider y awareness son privados.
 */
export class CollaborationManager {
  private _doc: Y.Doc | null = null;
  private _provider: YWebSocketProvider | null = null;
  private _unbindYjs: (() => void) | null = null;
  private _teardownAwareness: (() => void) | null = null;
  private _offSync: (() => void) | null = null;
  private _offStatus: (() => void) | null = null;
  private _syncHandled = false;
  private _visualSubscribers = new Set<(visualState: Record<string, { x: number; y: number }>) => void>();
  private _unbindVisualState: (() => void) | null = null;

  /**
   * Conecta a una sala colaborativa.
   *
   * Orden de operaciones:
   * 1. Crear Y.Doc
   * 2. Crear YWebSocketProvider (sin conectar aún)
   * 3. Registrar listeners de status y sync
   * 4. Configurar awareness
   * 5. Conectar el provider → WebSocket inicia handshake
   *
   * La decisión de autoridad (remoto vs. local) se ejecuta en el handler de 'sync'.
   */
  connect(roomName: string, displayName?: string): void {
    // Si ya hay una conexión activa, desconectar primero para evitar listeners duplicados
    if (this._provider) {
      this.disconnect();
    }

    this._syncHandled = false;

    // 1. Documento
    this._doc = createYjsDocument();

    // 2. Provider (sin conectar)
    this._provider = new YWebSocketProvider(this._doc, roomName);

    // Actualizar store: conectando
    this._updateStore({ status: 'connecting', roomName, error: null });

    // 3a. Listener de estado del WebSocket
    this._offStatus = this._provider.onStatus(({ status }) => {
      if (status === 'connected') {
        if (!this._syncHandled) {
          this._updateStore({ status: 'connected' });
          // Fallback de seguridad: si tras 1s no ha disparado sync, forzar sync si el provider ya sincronizó
          setTimeout(() => {
            if (!this._syncHandled && this._doc && this._provider) {
              handleSync();
            }
          }, 1000);
        }
      } else if (status === 'disconnected') {
        // Solo actualizar si ya habíamos sincronizado (no durante la conexión inicial)
        if (this._syncHandled) {
          this._updateStore({ status: 'disconnected' });
        }
      }
    });

    // 3b. Listener de sincronización — PUNTO CRÍTICO DE AUTORIDAD
    const handleSync = () => {
      if (this._syncHandled || !this._doc) return;
      this._syncHandled = true;

      this._updateStore({ status: 'synced' });
      this._applyDocumentAuthority(this._doc);

      // 4. Iniciar bindings bidireccionales DESPUÉS de resolver autoridad
      this._unbindYjs = bindYjsToStore(this._doc);
      this._setupVisualStateObserver(this._doc);
    };

    this._offSync = this._provider.onSync((isSynced) => {
      if (!isSynced) return;
      handleSync();
    });

    // 4. Awareness
    const identity = displayName
      ? { ...getOrCreateLocalIdentity(), name: displayName }
      : getOrCreateLocalIdentity();

    // Persistir displayName actualizado en sessionStorage si fue provisto
    if (displayName) {
      try {
        const stored = sessionStorage.getItem('umlforge-identity');
        const parsed = stored ? JSON.parse(stored) : {};
        sessionStorage.setItem(
          'umlforge-identity',
          JSON.stringify({ ...parsed, name: displayName })
        );
      } catch { /* silenciar */ }
    }

    this._teardownAwareness = setupAwareness(
      this._provider,
      identity,
      (peers: PeerInfo[], localClientId: number) => {
        this._updateStore({ peers, peersCount: peers.length, localClientId });
      }
    );

    // 5. Conectar
    this._provider.connect();
  }

  /**
   * Desconecta limpiamente, en el orden correcto:
   * 1. unbind (detener sync bidireccional)
   * 2. teardownAwareness (quitar listener + limpiar estado local)
   * 3. Remover listeners de status/sync
   * 4. provider.disconnect() (cerrar WS)
   * 5. provider.destroy() (liberar recursos internos)
   * 6. doc.destroy()
   * 7. Resetear store
   */
  disconnect(): void {
    // 1. Bindings
    if (this._unbindYjs) {
      this._unbindYjs();
      this._unbindYjs = null;
    }
    if (this._unbindVisualState) {
      this._unbindVisualState();
      this._unbindVisualState = null;
    }

    // 2. Awareness
    if (this._teardownAwareness) {
      this._teardownAwareness();
      this._teardownAwareness = null;
    }

    // 3. Listeners del provider
    if (this._offSync) {
      this._offSync();
      this._offSync = null;
    }
    if (this._offStatus) {
      this._offStatus();
      this._offStatus = null;
    }

    // 4 + 5. Provider
    if (this._provider) {
      this._provider.disconnect();
      this._provider.destroy();
      this._provider = null;
    }

    // 6. Documento
    if (this._doc) {
      this._doc.destroy();
      this._doc = null;
    }

    // 7. Store
    this._syncHandled = false;
    useModelStore.getState().resetCollaboration();
  }

  /**
   * Actualiza un campo específico del estado local en Awareness (ej. cursor, selección).
   */
  setAwarenessLocalStateField(key: string, value: any): void {
    if (this._provider) {
      const awareness = this._provider.getAwareness();
      awareness.setLocalStateField(key, value);
    }
  }

  /**
   * Lógica de autoridad del documento colaborativo.
   *
   * Se invoca ÚNICAMENTE tras el primer evento 'sync' (isSynced=true).
   * En ese punto, el Y.Doc refleja el estado real del servidor.
   *
   * Reglas:
   * - Si la sala tiene modelo Y el modelo local es diferente → sala gana, warning
   * - Si la sala tiene modelo E iguales → sin acción, sin warning
   * - Si la sala está vacía Y hay modelo local → publicar local
   * - Si ambos están vacíos → sin acción
   */
  private _applyDocumentAuthority(doc: Y.Doc): void {
    const remoteJson = getModelJson(doc);
    const localModel = useModelStore.getState().model;
    const isLocalEmpty = !localModel || (!localModel.classes?.length && !localModel.components?.length);

    if (remoteJson) {
      try {
        const remoteModel = JSON.parse(remoteJson);
        const isRemoteEmpty = !remoteModel || (!remoteModel.classes?.length && !remoteModel.components?.length);

        if (!isRemoteEmpty) {
          // La sala tiene elementos válidos -> adoptar el modelo remoto en Zustand
          useModelStore.getState().setModel(remoteModel);
        } else if (!isLocalEmpty) {
          // La sala está vacía pero localmente tenemos un modelo con clases -> publicar local
          setModelJson(doc, JSON.stringify(localModel), 'umlforge-local');
        }
      } catch {
        console.warn('[UMLForge Collaboration] No se pudo parsear el modelo remoto.');
      }
    } else if (!isLocalEmpty && localModel) {
      // Sala completamente vacía -> publicar modelo local
      setModelJson(doc, JSON.stringify(localModel), 'umlforge-local');
    }
  }

  private _updateStore(partial: {
    status?: CollaborationStatus;
    roomName?: string | null;
    peers?: PeerInfo[];
    peersCount?: number;
    localClientId?: number | null;
    error?: string | null;
  }): void {
    const store = useModelStore.getState();
    if (partial.status !== undefined) store.setCollaborationStatus(partial.status);
    if (partial.roomName !== undefined) store.setCollaborationRoom(partial.roomName);
    if (partial.peers !== undefined) store.setPeers(partial.peers);
    if (partial.peersCount !== undefined) store.setPeersCount(partial.peersCount);
    if (partial.localClientId !== undefined) store.setLocalClientId(partial.localClientId);
    if (partial.error !== undefined) store.setCollaborationError(partial.error);
  }

  // --- API para Visual State (Level 2) ---

  /**
   * Configura el observer del mapa visual-state en el Y.Doc.
   */
  private _setupVisualStateObserver(doc: Y.Doc): void {
    if (this._unbindVisualState) {
      this._unbindVisualState();
      this._unbindVisualState = null;
    }

    const map = doc.getMap<{ x: number; y: number }>('visual-state');

    const observer = (_event: Y.YMapEvent<{ x: number; y: number }>, transaction: Y.Transaction) => {
      if (transaction.origin === 'umlforge-local') return;
      const state = map.toJSON();
      this._visualSubscribers.forEach(cb => {
        try { cb(state); } catch (e) { console.error('[VisualState] Error en subscriber:', e); }
      });
    };

    map.observe(observer);
    this._unbindVisualState = () => {
      map.unobserve(observer);
    };

    // Emitir inmediatamente el estado sincronizado actual a todos los subscribers registrados
    const initialSnapshot = map.toJSON();
    if (Object.keys(initialSnapshot).length > 0) {
      this._visualSubscribers.forEach(cb => {
        try { cb(initialSnapshot); } catch (e) { console.error('[VisualState] Error en snapshot inicial:', e); }
      });
    }
  }

  /**
   * Obtiene el estado visual actual (nodeId -> {x, y})
   */
  getVisualState(): Record<string, { x: number; y: number }> | null {
    if (!this._doc) return null;
    const map = this._doc.getMap<{ x: number; y: number }>('visual-state');
    return map.toJSON();
  }

  /**
   * Actualiza el estado visual de un nodo de forma throttled localmente
   */
  updateVisualStateNode(nodeId: string, position: { x: number; y: number }): void {
    if (!this._doc) return;
    const map = this._doc.getMap<{ x: number; y: number }>('visual-state');
    this._doc.transact(() => {
      map.set(nodeId, position);
    }, 'umlforge-local');
  }

  /**
   * Elimina un nodo del estado visual localmente.
   */
  removeVisualStateNode(nodeId: string): void {
    if (!this._doc) return;
    const map = this._doc.getMap<{ x: number; y: number }>('visual-state');
    this._doc.transact(() => {
      map.delete(nodeId);
    }, 'umlforge-local');
  }

  /**
   * Suscribe a los cambios del estado visual provenientes de la red.
   */
  subscribeToVisualState(callback: (visualState: Record<string, { x: number; y: number }>) => void): () => void {
    this._visualSubscribers.add(callback);
    
    // Si ya existe el doc sincronizado, emitir de inmediato el snapshot actual
    if (this._doc) {
      const current = this.getVisualState();
      if (current && Object.keys(current).length > 0) {
        callback(current);
      }
    }

    return () => {
      this._visualSubscribers.delete(callback);
    };
  }
}
