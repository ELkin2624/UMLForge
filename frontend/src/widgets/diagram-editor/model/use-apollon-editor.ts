import { useRef, useMemo, useCallback } from 'react';
import { type ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';
import { useModelStore } from '../../../store/model-store';
import { useCollaboration, applyVisualStateToModel } from '../../../features/collaboration';
import { useShareStore } from '../../../features/sharing/model/share-store';
import { canEdit } from '../../../features/sharing/model/capabilities';
import { canonicalToApollon } from '../../../adapters/apollon-adapter';
import { useCanvasAwareness } from './use-canvas-awareness';
import { useVisualStateSync } from './use-visual-state-sync';
import { useModelSync } from './use-model-sync';

/**
 * Hook orquestador principal del ciclo de vida y eventos del editor Apollon.
 * Ensambla awareness de lienzo, visual state y sincronización de modelos.
 */
export function useApollonEditor() {
  const editorRef = useRef<NativeApollonEditor | null>(null);
  const localRole = useShareStore((s) => s.localRole);

  const {
    setAwarenessState,
    status,
    getVisualState,
    updateVisualStateNode,
    removeVisualStateNode,
    subscribeToVisualState,
  } = useCollaboration();

  const diagramType = useModelStore((s) => s.diagramType);

  // Hook de awareness (movimiento del mouse y cursor remoto)
  const { handleMouseMove, handleMouseLeave } = useCanvasAwareness({
    editorRef,
    status,
    setAwarenessState,
  });

  // Hook de sincronización de posiciones visuales de los nodos
  const {
    lastVisualStateRef,
    processLocalVisualState,
    subscribeToRemoteVisual,
  } = useVisualStateSync({
    updateVisualStateNode,
    removeVisualStateNode,
    subscribeToVisualState,
    setAwarenessState,
  });

  // Hook de sincronización del modelo canónico y selecciones
  const {
    updatingFromEditorRef,
    applyingExternalModelRef,
    initModelOnEditor,
    subscribeToRemoteModel,
    subscribeToLocalModel,
    subscribeToSelection,
  } = useModelSync({
    diagramType,
    lastVisualStateRef,
    processLocalVisualState,
    updateVisualStateNode,
    getVisualState,
    setAwarenessState,
  });

  // Calcular el modelo inicial para el diagrama de clases (solo se evalúa al montar)
  const initialModel = useMemo(() => {
    const currentModel = useModelStore.getState().model;
    if (
      !currentModel ||
      (!currentModel.classes?.length && !currentModel.components?.length)
    ) {
      return undefined;
    }
    const baseModel = canonicalToApollon(currentModel);

    const visual = getVisualState();
    if (visual && Object.keys(visual).length > 0) {
      return applyVisualStateToModel(baseModel, visual);
    }
    return baseModel;
  }, [getVisualState]);

  const handleMount = useCallback(
    (editor: NativeApollonEditor) => {
      editorRef.current = editor;

      initModelOnEditor(editor);

      let isMounting = true;
      setTimeout(() => {
        isMounting = false;
      }, 150);

      // 1. Suscripción a Zustand (Cambios REMOTOS o externos)
      const unsubscribeStore = subscribeToRemoteModel(editor);

      // 2. Suscripción a Apollon (Cambios LOCALES)
      const subId = subscribeToLocalModel(editor, () => isMounting);

      // 3. Suscripción a Visual State (Cambios REMOTOS en vivo)
      const unsubscribeVisualState = subscribeToRemoteVisual(
        editor,
        () => updatingFromEditorRef.current,
        (val) => {
          applyingExternalModelRef.current = val;
        }
      );

      // 4. Suscripción a Selección (Live Selection)
      const selectionSubId = subscribeToSelection(editor);

      return () => {
        unsubscribeStore();
        unsubscribeVisualState();
        editor.unsubscribe(subId);
        editor.unsubscribe(selectionSubId);
        editorRef.current = null;
      };
    },
    [
      initModelOnEditor,
      subscribeToRemoteModel,
      subscribeToLocalModel,
      subscribeToRemoteVisual,
      subscribeToSelection,
      updatingFromEditorRef,
      applyingExternalModelRef,
    ]
  );

  return {
    editorRef,
    localRole,
    canEditDiagram: canEdit(localRole),
    initialModel,
    handleMouseMove,
    handleMouseLeave,
    handleMount,
  };
}
