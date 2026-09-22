import { useModelStore } from '../../../store/model-store';
import type { PeerInfo } from './types';

/**
 * Hook para leer el estado de presencia (peers) desde el store.
 * peersCount incluye al propio cliente cuando está conectado.
 */
export function usePresence(): {
  peers: PeerInfo[];
  peersCount: number;
  localClientId: number | null;
} {
  const peers = useModelStore((s) => s.collaboration.peers);
  const peersCount = useModelStore((s) => s.collaboration.peersCount);
  const localClientId = useModelStore((s) => s.collaboration.localClientId);
  return { peers, peersCount, localClientId };
}
