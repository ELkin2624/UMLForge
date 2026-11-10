import type { CollaborationStatus } from './types';

/**
 * El panel de Colaboración solo aparece cuando hay alguien más (o un error de conexión).
 * Al abrir un diagrama siempre se entra a su sala para poder guardar; mientras estás
 * solo no hay nada que mostrar y el editor se comporta como uno normal.
 * `peersCount` incluye al propio cliente y excluye al agente de IA.
 */
export function shouldShowCollaborationPanel(
  status: CollaborationStatus,
  peersCount: number,
): boolean {
  if (status === 'error') return true;
  if (status !== 'connected' && status !== 'synced') return false;
  return peersCount > 1;
}
