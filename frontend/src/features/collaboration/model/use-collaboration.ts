import { useRef, useCallback } from 'react';
import { CollaborationManager } from './collaboration-manager';
import { getOrCreateLocalIdentity } from './awareness';
import { useModelStore } from '../../../store/model-store';
import { useAuthStore } from '../../auth/store';

let sharedCollaborationManager: CollaborationManager | null = null;

function getSharedCollaborationManager(): CollaborationManager {
  if (!sharedCollaborationManager) {
    sharedCollaborationManager = new CollaborationManager();
  }
  return sharedCollaborationManager;
}

/**
 * Hook principal de colaboración en tiempo real.
 *
 * Utiliza un CollaborationManager compartido por la pestaña del navegador.
 * Expone callbacks estables para conectar/desconectar desde la UI.
 *
 * Seguro para React 18/19 Strict Mode:
 * - El manager persiste a través de los ciclos mount/unmount.
 * - La conexión no se interrumpe prematuramente.
 */
export function useCollaboration() {
  const manager = getSharedCollaborationManager();

  // Obtener identidad estable desde sessionStorage (no regenera en re-renders)
  const identityRef = useRef(getOrCreateLocalIdentity());

  const connect = useCallback(
    (roomName: string, displayName?: string) => {
      const authUser = useAuthStore.getState().user;
      const authName = authUser?.display_name || authUser?.username;
      const name = displayName ?? authName ?? identityRef.current.name;
      manager.connect(roomName, name);
    },
    [manager]
  );

  const disconnect = useCallback(() => {
    manager.disconnect();
  }, [manager]);

  const setAwarenessState = useCallback(
    (key: string, value: any) => {
      manager.setAwarenessLocalStateField(key, value);
    },
    [manager]
  );

  // Estado observable desde Zustand (solo UI)
  const collaboration = useModelStore((s) => s.collaboration);
  const roomNameWarning = useModelStore((s) => s.roomNameWarning);
  const clearWarning = useCallback(() => {
    useModelStore.getState().setRoomNameWarning(null);
  }, []);

  // API para Visual State
  const getVisualState = useCallback(() => {
    return manager.getVisualState();
  }, [manager]);

  const updateVisualStateNode = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      manager.updateVisualStateNode(nodeId, position);
    },
    [manager]
  );

  const removeVisualStateNode = useCallback(
    (nodeId: string) => {
      manager.removeVisualStateNode(nodeId);
    },
    [manager]
  );

  const subscribeToVisualState = useCallback(
    (cb: (state: Record<string, { x: number; y: number }>) => void) => {
      return manager.subscribeToVisualState(cb);
    },
    [manager]
  );

  return {
    connect,
    disconnect,
    setAwarenessState,
    getVisualState,
    updateVisualStateNode,
    removeVisualStateNode,
    subscribeToVisualState,
    status: collaboration.status,
    roomName: collaboration.roomName,
    peersCount: collaboration.peersCount,
    peers: collaboration.peers,
    localClientId: collaboration.localClientId,
    displayName:
      useAuthStore.getState().user?.display_name ||
      useAuthStore.getState().user?.username ||
      identityRef.current.name,
    error: collaboration.error,
    roomNameWarning,
    clearWarning,
  };
}
