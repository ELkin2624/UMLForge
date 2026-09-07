import type { Awareness } from 'y-protocols/awareness';
import type { ICollaborationProvider } from './provider';
import type { LocalIdentity, PeerInfo } from './types';

const STORAGE_KEY = 'umlforge-identity';
const ADJECTIVES = ['Rápido', 'Ágil', 'Veloz', 'Claro', 'Sabio', 'Firme', 'Leal', 'Justo'];
const NOUNS = ['Arquitecto', 'Diseñador', 'Analista', 'Modelador', 'Creador', 'Autor'];

/**
 * Genera o recupera la identidad local del cliente desde sessionStorage.
 *
 * GARANTÍA: Retorna siempre los mismos valores dentro de la misma pestaña/sesión,
 * independientemente del número de llamadas o renders de React.
 * Sobrevive re-renders pero NO persiste entre pestañas (sessionStorage por diseño).
 *
 * La identidad es únicamente para presencia visual; no implica autenticación.
 */
export function getOrCreateLocalIdentity(): LocalIdentity {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as LocalIdentity;
      if (parsed.name && parsed.color) {
        return parsed;
      }
    }
  } catch {
    // sessionStorage no disponible (SSR, tests sin jsdom configurado, etc.)
  }

  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = Math.floor(Math.random() * 900 + 100); // 100-999
  const hue = Math.floor(Math.random() * 360);
  const identity: LocalIdentity = {
    name: `${adj} ${noun} ${suffix}`,
    color: `hsl(${hue}, 70%, 55%)`,
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // silenciar error de escritura
  }

  return identity;
}

/**
 * Configura la presencia local (awareness) en el proveedor.
 *
 * - Establece el estado local con nombre y color.
 * - Suscribe al evento 'change' de awareness para notificar cambios de peers.
 * - Retorna una función `teardown` que elimina el listener y limpia el estado local.
 *
 * No instala dependencias adicionales: usa el awareness del propio proveedor.
 */
export function setupAwareness(
  provider: ICollaborationProvider,
  identity: LocalIdentity,
  onPeersChange: (peers: PeerInfo[], localClientId: number) => void
): () => void {
  const awareness: Awareness = provider.getAwareness();

  // Establecer estado local
  awareness.setLocalState({
    user: {
      name: identity.name,
      color: identity.color,
    },
  });

  // Handler de cambios de peers
  const onAwarenessChange = () => {
    const peers = buildPeerList(awareness);
    onPeersChange(peers, awareness.clientID);
  };

  awareness.on('change', onAwarenessChange);

  // Emitir estado inicial
  onAwarenessChange();

  return function teardown() {
    awareness.off('change', onAwarenessChange);
    // Limpiar estado local para que otros clientes nos vean como desconectados
    awareness.setLocalState(null);
  };
}

/**
 * Construye la lista de peers desde el mapa de awareness.
 *
 * peersCount incluye al propio cliente (clientId propio también aparece en getStates()).
 * Esta semántica está documentada en types.ts.
 */
function buildPeerList(awareness: Awareness): PeerInfo[] {
  const peers: PeerInfo[] = [];
  awareness.getStates().forEach((state, clientId) => {
    const user = state?.user as { name?: string; color?: string } | undefined;
    const cursor = state?.cursor as { x: number; y: number } | undefined;
    const selectedNode = state?.selectedNode as string | undefined;
    const editingNode = state?.editingNode as string | undefined;

    peers.push({
      clientId,
      name: user?.name ?? `Usuario-${clientId}`,
      color: user?.color ?? '#888888',
      cursor,
      selectedNode,
      editingNode,
    });
  });
  return peers;
}
