import { getDiagram, saveDiagram } from '../../../api/diagrams-api';
import { useModelStore } from '../../../store/model-store';
import { useShareStore } from '../../sharing/model/share-store';
import { canEdit } from '../../sharing/model/capabilities';
import { getSharedCollaborationManager } from '../../collaboration';
import { useAuthStore } from '../../auth/store';
import { useDashboardStore } from '../../projects-dashboard/model/dashboard-store';
import { useVersioningStore } from '../../versioning';
import { emptyModel, hasContent, toRole } from './diagram-utils';

const ACTIVE_KEY = 'umlforge-active-diagram';
const COLLAB_KEY = 'umlforge-collab-active';

function connectToDiagram(id: string): void {
  if (useDashboardStore.getState().screen !== 'editor') return;
  const user = useAuthStore.getState().user;
  getSharedCollaborationManager().connect(
    id, user?.display_name || user?.username
  );
  try { sessionStorage.setItem(COLLAB_KEY, 'true'); } catch { /* opcional */ }
}

function rememberActive(id: string): void {
  try {
    sessionStorage.setItem(ACTIVE_KEY, id);
    const url = new URL(window.location.href);
    url.searchParams.set('diagram', id);
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* sin sessionStorage el cambio igual funciona, solo no se recuerda al recargar */
  }
}

/**
 * Cambia el diagrama activo del editor.
 *
 * El orden importa: el modelo nuevo se carga solo DESPUÉS de cambiar `roomId`, y
 * el guardado del diagrama anterior se hace antes. Si no, `useAutosave` podría
 * guardar el modelo de un diagrama dentro del otro.
 */
export async function switchToDiagram(id: number | string): Promise<void> {
  const target = String(id);
  const share = useShareStore.getState();
  if (share.roomId === target) {
    connectToDiagram(target);
    return;
  }

  // 1. Traer el destino primero: si falla, no se toca nada del estado actual.
  const diagram = await getDiagram(target);

  // 2. No perder lo pendiente del diagrama actual.
  const current = useModelStore.getState().model;
  if (share.roomId && current && canEdit(share.localRole)) {
    await saveDiagram(share.roomId, current);
  }

  // 3. Salir de la sala colaborativa del diagrama anterior.
  getSharedCollaborationManager().disconnect();
  useShareStore.getState().endSession();

  // 4. Nuevo diagrama activo.
  rememberActive(target);
  useShareStore.getState().setRoomId(target);
  useShareStore.getState().setLocalRole(toRole(diagram.my_role));
  useVersioningStore.getState().markSaved(false);

  // 5. Dejar que React reinicie el autosave (cleanup + efecto nuevo) antes del modelo.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  // 6. Cargar el modelo. Un diagrama vacío usa un modelo vacío (no null: el editor ignora null).
  const model = hasContent(diagram.data) ? diagram.data : emptyModel(diagram.name);
  useModelStore.getState().setModel(model);
  connectToDiagram(target);
}
