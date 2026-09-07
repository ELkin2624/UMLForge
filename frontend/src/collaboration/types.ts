/**
 * Tipos de colaboración para la Fase 11 de UMLForge.
 *
 * NOTA: El modelo canónico se almacena como un único JSON string en Y.Map.
 * No hay granularidad CRDT por campo/atributo: el último en escribir gana
 * a nivel de documento completo. Esta limitación es intencionada en esta fase.
 */

/**
 * Estados de colaboración:
 * - idle        → sin conexión, editor funciona localmente
 * - connecting  → WebSocket iniciando handshake
 * - connected   → WebSocket conectado, sincronización pendiente
 * - synced      → WebSocket conectado + Y.Doc sincronizado con el servidor
 * - disconnected→ desconectado voluntariamente o por caída de red
 * - error       → fallo irrecuperable en el proveedor
 */
export type CollaborationStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'synced'
  | 'disconnected'
  | 'error';

/**
 * Información de un peer/usuario conectado.
 *
 * clientId: identificador técnico único asignado por Yjs/Awareness.
 *           Dos personas con el mismo displayName siempre tienen clientId distintos.
 * name:     etiqueta visual (displayName). Solo para presencia, no para permisos.
 * color:    color HSL generado una vez por sesión y persistido en sessionStorage.
 */
export interface PeerInfo {
  clientId: number;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedNode?: string;
  editingNode?: string;
}

/**
 * Estado de colaboración que se expone a la UI a través de Zustand.
 *
 * Invariantes:
 * - peersCount incluye al propio cliente cuando está conectado.
 *   Ejemplo: 3 clientes en la misma sala → peersCount = 3.
 * - peers contiene la lista completa incluyendo el propio cliente.
 * - Y.Doc, WebsocketProvider y Awareness NUNCA se almacenan aquí.
 */
export interface CollaborationUiState {
  status: CollaborationStatus;
  roomName: string | null;
  /** Número total de usuarios en la sala, incluido el propio cliente. */
  peersCount: number;
  peers: PeerInfo[];
  localClientId: number | null;
  displayName: string;
  error: string | null;
}

/**
 * Identidad local del cliente, generada una vez por sesión y persistida en sessionStorage.
 * Se usa para Awareness. No representa autenticación ni permisos.
 */
export interface LocalIdentity {
  name: string;
  color: string;
}
