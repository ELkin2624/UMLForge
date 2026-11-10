import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { type ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';
import { useModelStore } from '../../../store/model-store';
import { useCollaboration, applyVisualStateToModel, useCommandConflict } from '../../../features/collaboration';
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
  const roomId = useShareStore((s) => s.roomId);
  const conflict = useCommandConflict();

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

  const canEditDiagram =
    canEdit(localRole) && status === 'synced' && !(conflict.room === roomId && conflict.message);

  // Apollon mide la paleta una sola vez al montar y no la dibuja en solo lectura. Como el
  // editor se monta en solo lectura mientras conecta la sala, se remonta (una sola vez)
  // al volverse editable para que la paleta tome su tamaño real y no el mínimo.
  const [becameEditable, setBecameEditable] = useState(canEditDiagram);
  useEffect(() => {
    if (canEditDiagram) setBecameEditable(true);
  }, [canEditDiagram]);

  return {
    editorRef,
    localRole,
    editorKey: `ClassDiagram-${localRole}-${becameEditable ? 'edit' : 'view'}`,
    canEditDiagram,
    initialModel,
    handleMouseMove,
    handleMouseLeave,
    handleMount,
  };
}
