import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

/**
 * Interfaz del proveedor de red para colaboración.
 * Implementada por YWebSocketProvider; permite sustituir el transporte sin cambiar el manager.
 */
export interface ICollaborationProvider {
  /** Inicia la conexión al servidor WebSocket. */
  connect(): void;

  /** Cierra la conexión WebSocket y elimina listeners internos del proveedor. */
  disconnect(): void;

  /** Destruye el proveedor liberando todos los recursos internos. */
  destroy(): void;

  /** Retorna la instancia de Awareness del proveedor (no instanciar otra). */
  getAwareness(): Awareness;

  /**
   * Registra un callback que se invoca cuando el estado de la conexión cambia.
   * El parámetro `isSynced` es true cuando el Y.Doc está completamente sincronizado.
   * Retorna una función para cancelar el listener.
   */
  onSync(callback: (isSynced: boolean) => void): () => void;

  /**
   * Registra un callback invocado cuando el WebSocket se conecta o desconecta.
   * El parámetro `status` es 'connected' | 'disconnected'.
   * Retorna una función para cancelar el listener.
   */
  onStatus(callback: (status: { status: 'connected' | 'disconnected' }) => void): () => void;

  /** Acceso al Y.Doc gestionado por este proveedor. */
  readonly doc: Y.Doc;
}
