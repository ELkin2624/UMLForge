import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { setupAwareness } from './awareness';
import type { PeerInfo } from './types';

/** Simula que el servidor publica al agente de IA como un peer más de la sala. */
function remoteAgent(local: Awareness): void {
  const server = new Awareness(new Y.Doc());
  server.setLocalState({ user: { name: 'Asistente IA', color: '#8B5CF6', isAgent: true } });
  // Copia directa del estado remoto en el awareness local (equivale a recibirlo por la red)
  (local as unknown as { states: Map<number, unknown> }).states.set(server.clientID, server.getLocalState());
  local.emit('change', [{ added: [server.clientID], updated: [], removed: [] }, 'test']);
}

describe('awareness: agente de IA', () => {
  it('marca al agente como tal y lo distingue de las personas', () => {
    const awareness = new Awareness(new Y.Doc());
    let peers: PeerInfo[] = [];
    setupAwareness(
      { getAwareness: () => awareness } as never,
      { name: 'Ana', color: '#fff' },
      (p) => {
        peers = p;
      },
    );
    remoteAgent(awareness);

    const agent = peers.find((p) => p.isAgent);
    expect(agent).toMatchObject({ name: 'Asistente IA', isAgent: true });
    expect(peers.find((p) => p.name === 'Ana')?.isAgent).toBe(false);
  });
});
