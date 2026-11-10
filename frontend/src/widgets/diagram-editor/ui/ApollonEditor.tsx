import React from 'react';
import { Apollon } from '@tumaet/apollon';
import { CursorOverlay } from '../../../components/presence/CursorOverlay';
import { SelectionOverlay } from '../../../components/presence/SelectionOverlay';
import { useApollonEditor } from '../model/use-apollon-editor';
import { AgentPreview, CommandConflictBanner } from '../../../features/ai-assistant';

/** Componente visual del editor de diagramas UML (Apollon) estructurado según FSD.
 * Responsabilidad exclusiva: Renderizar el canvas, overlays de presencia y vincular eventos. */
export const ApollonEditor: React.FC = () => {
  const {
    editorRef,
    editorKey,
    canEditDiagram,
    initialModel,
    handleMouseMove,
    handleMouseLeave,
    handleMount,
  } = useApollonEditor();

  return (
    <div
      className="case-editor"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <CursorOverlay editorRef={editorRef} />
      <AgentPreview editorRef={editorRef} />
      <CommandConflictBanner />
      <SelectionOverlay editorRef={editorRef} />
      <Apollon
        key={editorKey}
        style={{ width: '100%', height: '100%' }}
        readonly={!canEditDiagram}
        defaultModel={initialModel}
        defaultType="ClassDiagram"
        onMount={handleMount}
      />
    </div>
  );
};
