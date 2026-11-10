import { useRef, useCallback } from 'react';
import { type ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';
import {
  extractVisualStateFromModel,
  getVisualStateDelta,
  getVisualStateDeletions,
  applyVisualStateToModel,
} from '../../../features/collaboration';
import { VisualStateMap, VisualPosition } from './types';

interface UseVisualStateSyncOptions {
  updateVisualStateNode: (id: string, pos: VisualPosition) => void;
  removeVisualStateNode: (id: string) => void;
  subscribeToVisualState: (callback: (remote: VisualStateMap) => void) => () => void;
  setAwarenessState: (key: string, value: any) => void;
}

/** Tiempo sin movimiento para dar por terminado un arrastre y enviar la posición final. */
export const DRAG_SETTLE_MS = 200;

/**
 * Hook responsable de la sincronización de posiciones visuales (y tamaño) de los nodos:
 * envía la posición final al terminar cada arrastre y aplica los cambios remotos.
 */
export function useVisualStateSync({
  updateVisualStateNode,
  removeVisualStateNode,
  subscribeToVisualState,
  setAwarenessState,
}: UseVisualStateSyncOptions) {
  const lastVisualStateRef = useRef<VisualStateMap>({});
  const pendingVisualUpdatesRef = useRef<VisualStateMap>({});
  const pendingDeletionsRef = useRef<Set<string>>(new Set());
  const dragEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushVisualUpdates = useCallback(() => {
    const updates = { ...pendingVisualUpdatesRef.current };
    pendingVisualUpdatesRef.current = {};
    const delList = Array.from(pendingDeletionsRef.current);
    pendingDeletionsRef.current.clear();

    Object.entries(updates).forEach(([id, pos]) => {
      updateVisualStateNode(id, pos);
    });
    delList.forEach((id) => {
      removeVisualStateNode(id);
    });
  }, [updateVisualStateNode, removeVisualStateNode]);

  const processLocalVisualState = useCallback(
    (apollonState: any) => {
      const newVisualState = extractVisualStateFromModel(apollonState);
      const delta = getVisualStateDelta(lastVisualStateRef.current, newVisualState);
      const deletions = getVisualStateDeletions(lastVisualStateRef.current, newVisualState);

      if (Object.keys(delta).length > 0 || deletions.length > 0) {
        Object.entries(delta).forEach(([id, pos]) => {
          pendingVisualUpdatesRef.current[id] = pos;
          pendingDeletionsRef.current.delete(id);
          lastVisualStateRef.current[id] = pos;
        });
        deletions.forEach((id) => {
          delete pendingVisualUpdatesRef.current[id];
          pendingDeletionsRef.current.add(id);
          delete lastVisualStateRef.current[id];
        });

        const draggingNodes = Object.keys(delta);
        if (draggingNodes.length > 0) {
          // Durante un arrastre la posición solo cambia en este lienzo; se envía UNA vez al
          // soltar. Antes se enviaba cada paso: cada uno era una escritura en la base (en la
          // nube) y una versión del historial, y los demás veían la clase avanzar a saltos.
          setAwarenessState('draggingNode', draggingNodes[0]);
          if (dragEndTimeoutRef.current) clearTimeout(dragEndTimeoutRef.current);
          dragEndTimeoutRef.current = setTimeout(() => {
            setAwarenessState('draggingNode', null);
            flushVisualUpdates();
          }, DRAG_SETTLE_MS);
        } else {
          // Solo borrados: no hay arrastre que esperar.
          flushVisualUpdates();
        }
      }

      return newVisualState;
    },
    [flushVisualUpdates, setAwarenessState]
  );

  const subscribeToRemoteVisual = useCallback(
    (
      editor: NativeApollonEditor,
      isUpdatingFromEditor: () => boolean,
      setApplyingExternalModel: (val: boolean) => void
    ) => {
      return subscribeToVisualState((remoteVisualState) => {
        if (isUpdatingFromEditor()) return;

        lastVisualStateRef.current = {
          ...lastVisualStateRef.current,
          ...remoteVisualState,
        };
        const currentApollonModel = editor.model;
        const mergedModel = applyVisualStateToModel(
          currentApollonModel,
          remoteVisualState
        );

        setApplyingExternalModel(true);
        editor.model = mergedModel;
        // Liberar el flag en el siguiente frame de animación para evitar
        // que el eco de Apollon se procese como cambio local.
        requestAnimationFrame(() => {
          setApplyingExternalModel(false);
        });
      });
    },
    [subscribeToVisualState]
  );

  return {
    lastVisualStateRef,
    processLocalVisualState,
    flushVisualUpdates,
    subscribeToRemoteVisual,
  };
}
