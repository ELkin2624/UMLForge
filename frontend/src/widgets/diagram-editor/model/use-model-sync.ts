import React, { useRef, useCallback } from 'react';
import { type ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';
import { useModelStore } from '../../../store/model-store';
import { useShareStore } from '../../../features/sharing/model/share-store';
import { canEdit } from '../../../features/sharing/model/capabilities';
import {
  apollonToCanonical,
  applyCanonicalModelToApollon,
  autoDecomposeManyToMany,
} from '../../../adapters/apollon-adapter';
import { VisualStateMap, VisualPosition } from './types';

interface UseModelSyncOptions {
  diagramType: any;
  lastVisualStateRef: React.MutableRefObject<VisualStateMap>;
  processLocalVisualState: (apollonState: any) => VisualStateMap;
  updateVisualStateNode: (id: string, pos: VisualPosition) => void;
  getVisualState: () => VisualStateMap | null | undefined;
  setAwarenessState: (key: string, value: any) => void;
}

/**
 * Hook responsable de la sincronización bidireccional entre el modelo de Apollon
 * y el almacén canónico de Zustand/Yjs, incluyendo:
 * - Filtro de cambios locales vs remotos (bloqueo anti-eco)
 * - Descomposición automática de relaciones muchos a muchos (* a *)
 * - Live selection awareness
 */
export function useModelSync({
  diagramType,
  lastVisualStateRef,
  processLocalVisualState,
  updateVisualStateNode,
  getVisualState,
  setAwarenessState,
}: UseModelSyncOptions) {
  // Ref para saber si el cambio de modelo vino del propio editor local
  const updatingFromEditorRef = useRef(false);

  // Ref para evitar bucles cuando aplicamos un cambio remoto al editor
  const applyingExternalModelRef = useRef(false);

  // Ref con el último JSON canónico que ya fue aplicado o emitido por el editor
  const lastAppliedModelJsonRef = useRef<string | null>(null);
  const lastModelIdRef = useRef<string | null>(null);

  const lastSelectedNodeRef = useRef<string | null>(null);

  const setModel = useModelStore((s) => s.setModel);

  const initModelOnEditor = useCallback(
    (editor: NativeApollonEditor) => {
      const currentModel = useModelStore.getState().model;
      const initialVisualState = getVisualState();
      if (initialVisualState) {
        lastVisualStateRef.current = initialVisualState;
      }

      const hasElements = Boolean(
        currentModel &&
          (currentModel.classes?.length || currentModel.components?.length)
      );

      if (hasElements && currentModel) {
        lastAppliedModelJsonRef.current = JSON.stringify(currentModel);
        lastModelIdRef.current = currentModel.id || null;
        applyingExternalModelRef.current = true;
        applyCanonicalModelToApollon(
          editor,
          currentModel,
          diagramType,
          lastVisualStateRef.current
        );
        setTimeout(() => {
          applyingExternalModelRef.current = false;
        }, 200);
      }
    },
    [diagramType, getVisualState, lastVisualStateRef]
  );

  const subscribeToRemoteModel = useCallback(
    (editor: NativeApollonEditor) => {
      return useModelStore.subscribe(
        (state) => state.model,
        (newModel) => {
          if (!newModel || updatingFromEditorRef.current) return;

          const currentModelJson = JSON.stringify(newModel);
          if (currentModelJson === lastAppliedModelJsonRef.current) return;

          const isNewModelInstance =
            lastModelIdRef.current !== null && lastModelIdRef.current !== newModel.id;
          lastModelIdRef.current = newModel.id || null;

          // Origen remoto o importación. Aplicar a Apollon sin destruirlo.
          lastAppliedModelJsonRef.current = currentModelJson;

          applyingExternalModelRef.current = true;
          const freshVisualState = getVisualState();
          if (freshVisualState && !isNewModelInstance) {
            lastVisualStateRef.current = {
              ...lastVisualStateRef.current,
              ...freshVisualState,
            };
          } else if (isNewModelInstance) {
            lastVisualStateRef.current = {};
          }

          try {
            applyCanonicalModelToApollon(
              editor,
              newModel,
              diagramType,
              isNewModelInstance ? undefined : lastVisualStateRef.current,
              isNewModelInstance
            );
          } catch (e) {
            console.error('[ApollonEditor] Error applying remote model to Apollon:', e);
          }

          // Apollon dispara eventos 'subscribeToModelChange' de forma asíncrona
          // tras recibir un nuevo modelo. Mantenemos el bloqueo brevemente para ignorar el eco.
          setTimeout(() => {
            applyingExternalModelRef.current = false;
          }, 200);
        }
      );
    },
    [diagramType, getVisualState, lastVisualStateRef]
  );

  const subscribeToLocalModel = useCallback(
    (editor: NativeApollonEditor, isMountingCheck: () => boolean) => {
      return editor.subscribeToModelChange((apollonState) => {
        if (applyingExternalModelRef.current) return;
        if (!canEdit(useShareStore.getState().localRole)) return;

        // Protección contra montaje/inicialización: si el editor emite 0 nodos
        // pero en Zustand ya teníamos un modelo con clases/componentes,
        // ignoramos el evento para no blanquear el lienzo colaborativo.
        const currentStoreModel = useModelStore.getState().model;
        const storeHasElements = Boolean(
          currentStoreModel &&
            (currentStoreModel.classes?.length || currentStoreModel.components?.length)
        );
        if (apollonState.nodes.length === 0 && (isMountingCheck() || storeHasElements)) {
          return;
        }

        updatingFromEditorRef.current = true;
        try {
          const newVisualState = processLocalVisualState(apollonState);
          const baseModel = useModelStore.getState().model || undefined;
          const canonical = apollonToCanonical(apollonState, baseModel);

          // Normalizar y descomponer automáticamente relaciones Muchos a Muchos (* a *)
          const normResult = autoDecomposeManyToMany(
            canonical,
            lastVisualStateRef.current
          );
          const finalCanonical = normResult.canonical;
          const finalVisualState = normResult.visualState;

          if (normResult.decomposed) {
            lastVisualStateRef.current = finalVisualState;
            Object.entries(finalVisualState).forEach(([id, pos]) => {
              updateVisualStateNode(id, pos);
            });
            const normJson = JSON.stringify(finalCanonical);
            lastAppliedModelJsonRef.current = normJson;
            setModel(finalCanonical);

            applyingExternalModelRef.current = true;
            applyCanonicalModelToApollon(
              editor,
              finalCanonical,
              diagramType,
              finalVisualState
            );
            setTimeout(() => {
              applyingExternalModelRef.current = false;
            }, 150);
            return;
          }

          const canonicalJson = JSON.stringify(finalCanonical);

          // Filtro de ruido: si el CanonicalModel no cambió (ej. solo movió un nodo x/y),
          // no emitimos nada hacia Zustand/Yjs.
          if (canonicalJson === lastAppliedModelJsonRef.current) {
            return;
          }

          // Si hubo cambios semánticos, sincronizar todas las posiciones actuales de inmediato
          Object.entries(newVisualState).forEach(([id, pos]) => {
            updateVisualStateNode(id, pos);
          });

          lastAppliedModelJsonRef.current = canonicalJson;
          setModel(finalCanonical);
        } finally {
          updatingFromEditorRef.current = false;
        }
      });
    },
    [
      diagramType,
      lastVisualStateRef,
      processLocalVisualState,
      setModel,
      updateVisualStateNode,
    ]
  );

  const subscribeToSelection = useCallback(
    (editor: NativeApollonEditor) => {
      return editor.subscribeToSelectionChange((selectedElementIds) => {
        if (applyingExternalModelRef.current) return;
        const selected = selectedElementIds.length > 0 ? selectedElementIds[0] : null;

        if (selected === lastSelectedNodeRef.current) return;
        lastSelectedNodeRef.current = selected;

        useModelStore.getState().setSelectedNodeId(selected);
        setAwarenessState('selectedNode', selected);
        setAwarenessState('editingNode', selected);
      });
    },
    [setAwarenessState]
  );

  return {
    updatingFromEditorRef,
    applyingExternalModelRef,
    initModelOnEditor,
    subscribeToRemoteModel,
    subscribeToLocalModel,
    subscribeToSelection,
  };
}
