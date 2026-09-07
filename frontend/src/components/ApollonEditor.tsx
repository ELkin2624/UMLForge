import { useRef, useMemo, useCallback } from 'react';
import { Apollon, type ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';
import { useModelStore } from '../store/model-store';
import {
  apollonToCanonical,
  canonicalToApollon,
  applyCanonicalModelToApollon,
} from '../adapters/apollon-adapter';
import { extractVisualStateFromModel, getVisualStateDelta, getVisualStateDeletions, applyVisualStateToModel } from '../collaboration/visual-state-manager';
import { CursorOverlay } from './presence/CursorOverlay';
import { SelectionOverlay } from './presence/SelectionOverlay';
import { useCollaboration } from '../hooks/use-collaboration';
import { useShareStore } from '../features/sharing/model/share-store';
import { canEdit } from '../features/sharing/model/capabilities';

export const ApollonEditor = () => {
  const editorRef = useRef<NativeApollonEditor | null>(null);

  const { setAwarenessState, status, getVisualState, updateVisualStateNode, removeVisualStateNode, subscribeToVisualState } = useCollaboration();
  const lastMouseTimeRef = useRef(0);

  // --- Visual State Refs ---
  const lastVisualStateRef = useRef<Record<string, { x: number; y: number }>>({});
  const pendingVisualUpdatesRef = useRef<Record<string, { x: number; y: number }>>({});
  const pendingDeletionsRef = useRef<Set<string>>(new Set());
  const rafScheduledRef = useRef(false);
  const dragEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushVisualUpdates = useCallback(() => {
    const updates = { ...pendingVisualUpdatesRef.current };
    pendingVisualUpdatesRef.current = {};
    const delList = Array.from(pendingDeletionsRef.current);
    pendingDeletionsRef.current.clear();

    Object.entries(updates).forEach(([id, pos]) => {
      updateVisualStateNode(id, pos);
    });
    delList.forEach(id => {
      removeVisualStateNode(id);
    });
  }, [updateVisualStateNode, removeVisualStateNode]);

  // Ref para saber si el cambio de modelo vino del propio editor local
  const updatingFromEditorRef = useRef(false);

  // Ref para evitar bucles cuando aplicamos un cambio remoto al editor
  const applyingExternalModelRef = useRef(false);

  // Ref con el último JSON canónico que ya fue aplicado o emitido por el editor
  const lastAppliedModelJsonRef = useRef<string | null>(null);

  // NO escuchamos 'model' de forma reactiva para no provocar re-renderizados de React.
  // Solo escuchamos 'diagramType' que sí requiere desmontar/remontar el lienzo.
  const diagramType = useModelStore(s => s.diagramType);
  const setModel = useModelStore(s => s.setModel);

  // Calcular el modelo inicial para el diagrama de clases (solo se evalúa al montar)
  const initialModel = useMemo(() => {
    const currentModel = useModelStore.getState().model;
    if (!currentModel) return undefined;
    const baseModel = canonicalToApollon(currentModel);
    
    const visual = getVisualState();
    if (visual && Object.keys(visual).length > 0) {
      return applyVisualStateToModel(baseModel, visual);
    }
    return baseModel;
  }, [getVisualState]);

  const clearCursorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedNodeRef = useRef<string | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== 'connected' && status !== 'synced') return;
    if (!editorRef.current) return;
    
    if (clearCursorTimeoutRef.current) {
      clearTimeout(clearCursorTimeoutRef.current);
      clearCursorTimeoutRef.current = null;
    }

    const now = performance.now();
    // Throttle 30ms (~33 FPS) para movimiento suave de cursor
    if (now - lastMouseTimeRef.current < 30) return;
    lastMouseTimeRef.current = now;

    try {
      const flowPos = editorRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (flowPos && Number.isFinite(flowPos.x) && Number.isFinite(flowPos.y)) {
        setAwarenessState('cursor', { x: Math.round(flowPos.x), y: Math.round(flowPos.y) });
      }
    } catch {
      // Ignorar si Apollon aún no está listo
    }
  }, [status, setAwarenessState]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== 'connected' && status !== 'synced') return;
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) {
      return;
    }

    if (clearCursorTimeoutRef.current) clearTimeout(clearCursorTimeoutRef.current);
    clearCursorTimeoutRef.current = setTimeout(() => {
      setAwarenessState('cursor', null);
    }, 150);
  }, [status, setAwarenessState]);

  return (
    <div className="case-editor" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <CursorOverlay editorRef={editorRef} />
      <SelectionOverlay editorRef={editorRef} />
      <Apollon
        key="ClassDiagram"
        style={{ width: '100%', height: '100%' }}
        readonly={!canEdit(useShareStore.getState().localRole)}
        defaultModel={initialModel}
        defaultType="ClassDiagram"
        onMount={(editor) => {
          editorRef.current = editor;

          const currentModel = useModelStore.getState().model;
          if (currentModel) {
            lastAppliedModelJsonRef.current = JSON.stringify(currentModel);
          }

          const initialVisualState = getVisualState();
          if (initialVisualState) {
            lastVisualStateRef.current = initialVisualState;
          }

          let isInitialMountEvent = !currentModel;

          // 1. Suscripción a Zustand (Cambios REMOTOS o externos)
          const unsubscribeStore = useModelStore.subscribe(
            (state) => state.model,
            (newModel) => {
              if (!newModel || updatingFromEditorRef.current) return;

              const currentModelJson = JSON.stringify(newModel);
              if (currentModelJson === lastAppliedModelJsonRef.current) return;

              // Origen remoto o importación. Aplicar a Apollon sin destruirlo.
              lastAppliedModelJsonRef.current = currentModelJson;
              
              applyingExternalModelRef.current = true;
              const freshVisualState = getVisualState();
              if (freshVisualState) {
                lastVisualStateRef.current = { ...lastVisualStateRef.current, ...freshVisualState };
              }
              applyCanonicalModelToApollon(editor, newModel, diagramType, lastVisualStateRef.current);
              
              // Apollon dispara eventos 'subscribeToModelChange' de forma asíncrona
              // (en useEffects) tras recibir un nuevo modelo. Mantenemos el bloqueo
              // brevemente para ignorar el eco de nuestro propio cambio.
              setTimeout(() => {
                applyingExternalModelRef.current = false;
              }, 150);
            }
          );

          // 2. Suscripción a Apollon (Cambios LOCALES)
          const subId = editor.subscribeToModelChange((apollonState) => {
            if (applyingExternalModelRef.current) return;

            if (isInitialMountEvent) {
              isInitialMountEvent = false;
              // Si el canvas está vacío durante el montaje inicial, evitamos publicarlo 
              // para no sobreescribir el modelo remoto del servidor al conectarnos.
              if (apollonState.nodes.length === 0) {
                return;
              }
            }

            updatingFromEditorRef.current = true;
            try {
              const newVisualState = extractVisualStateFromModel(apollonState);
              const delta = getVisualStateDelta(lastVisualStateRef.current, newVisualState);
              const deletions = getVisualStateDeletions(lastVisualStateRef.current, newVisualState);
              
              if (Object.keys(delta).length > 0 || deletions.length > 0) {
                Object.entries(delta).forEach(([id, pos]) => {
                  pendingVisualUpdatesRef.current[id] = pos;
                  pendingDeletionsRef.current.delete(id);
                  lastVisualStateRef.current[id] = pos;
                });
                deletions.forEach(id => {
                  delete pendingVisualUpdatesRef.current[id];
                  pendingDeletionsRef.current.add(id);
                  delete lastVisualStateRef.current[id];
                });

                const draggingNodes = Object.keys(delta);
                if (draggingNodes.length > 0) {
                  setAwarenessState('draggingNode', draggingNodes[0]);
                  if (dragEndTimeoutRef.current) clearTimeout(dragEndTimeoutRef.current);
                  dragEndTimeoutRef.current = setTimeout(() => {
                    setAwarenessState('draggingNode', null);
                    flushVisualUpdates();
                  }, 150);
                }

                if (!rafScheduledRef.current) {
                  rafScheduledRef.current = true;
                  window.requestAnimationFrame(() => {
                    rafScheduledRef.current = false;
                    flushVisualUpdates();
                  });
                }
              }

              const baseModel = useModelStore.getState().model || undefined;
              const canonical = apollonToCanonical(apollonState, baseModel);

              const canonicalJson = JSON.stringify(canonical);
              
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
              setModel(canonical);
            } finally {
              updatingFromEditorRef.current = false;
            }
          });

          // 3. Suscripción a Visual State (Cambios REMOTOS en vivo)
          const unsubscribeVisualState = subscribeToVisualState((remoteVisualState) => {
            if (updatingFromEditorRef.current) return;
            
            lastVisualStateRef.current = { ...lastVisualStateRef.current, ...remoteVisualState };
            const currentApollonModel = editor.model;
            const mergedModel = applyVisualStateToModel(currentApollonModel, remoteVisualState);
            
            applyingExternalModelRef.current = true;
            editor.model = mergedModel;
            setTimeout(() => {
              applyingExternalModelRef.current = false;
            }, 100);
          });

          // 3. Suscripción a Selección (Live Selection)
          const selectionSubId = editor.subscribeToSelectionChange((selectedElementIds) => {
            if (applyingExternalModelRef.current) return;
            const selected = selectedElementIds.length > 0 ? selectedElementIds[0] : null;
            
            if (selected === lastSelectedNodeRef.current) return;
            lastSelectedNodeRef.current = selected;

            useModelStore.getState().setSelectedNodeId(selected);
            setAwarenessState('selectedNode', selected);
            setAwarenessState('editingNode', selected);
          });

          return () => {
            unsubscribeStore();
            unsubscribeVisualState();
            editor.unsubscribe(subId);
            editor.unsubscribe(selectionSubId);
            editorRef.current = null;
          };
        }}
      />
    </div>
  );
};

