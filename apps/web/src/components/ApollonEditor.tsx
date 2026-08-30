import { useEffect, useRef, useMemo } from 'react';
import { Apollon, ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';
import { useModelStore } from '../store/model-store';
import {
  apollonToCanonical,
  canonicalToApollon,
  canonicalComponentToApollon,
} from '../adapters/apollon-adapter';

export const ApollonEditor = () => {
  const editorRef = useRef<NativeApollonEditor | null>(null);

  // Ref para saber si el cambio de modelo vino del propio editor
  const updatingFromEditorRef = useRef(false);

  // Ref con el último canonical ID que ya fue aplicado al editor
  const lastAppliedModelIdRef = useRef<string | null>(null);

  const { model, diagramType, setModel } = useModelStore();

  // Calcular el modelo inicial para el tipo de diagrama actual
  const initialModel = useMemo(() => {
    if (!model) return undefined;
    return diagramType === 'component'
      ? canonicalComponentToApollon(model)
      : canonicalToApollon(model);
  }, [model, diagramType]);

  // Aplicar cambios externos al modelo
  useEffect(() => {
    if (!editorRef.current || !model) return;
    if (updatingFromEditorRef.current) return;
    if (model.id === lastAppliedModelIdRef.current) return;

    const newApollonModel = diagramType === 'component'
      ? canonicalComponentToApollon(model)
      : canonicalToApollon(model);

    editorRef.current.model = newApollonModel;
    lastAppliedModelIdRef.current = model.id ?? null;
  }, [model, diagramType]);

  return (
    <div className="case-editor">
      <Apollon
        key={diagramType}
        style={{ width: '100%', height: '100%' }}
        defaultModel={initialModel}
        defaultType={diagramType === 'component' ? 'ComponentDiagram' : 'ClassDiagram'}
        onMount={(editor) => {
          editorRef.current = editor;
          
          if (model) {
            lastAppliedModelIdRef.current = model.id ?? null;
          }

          const subId = editor.subscribeToModelChange((apollonState) => {
            updatingFromEditorRef.current = true;
            
            // Pasamos el modelo actual del store como base para preservar el otro submodelo
            const currentModel = useModelStore.getState().model || undefined;
            const canonical = apollonToCanonical(apollonState, currentModel);
            lastAppliedModelIdRef.current = canonical.id ?? null;
            setModel(canonical);
            
            // Liberamos la bandera en el siguiente microtask
            Promise.resolve().then(() => {
              updatingFromEditorRef.current = false;
            });
          });

          return () => {
            editor.unsubscribe(subId);
            editorRef.current = null;
          };
        }}
      />
    </div>
  );
};

