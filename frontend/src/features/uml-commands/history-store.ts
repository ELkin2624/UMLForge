import { create } from 'zustand';
import { useModelStore } from '../../store/model-store';
import { markAiChange } from '../versioning';
import { canEdit } from '../sharing/model/capabilities';
import { useShareStore } from '../sharing/model/share-store';
import type { UMLModel } from '../../types/canonical-model';
import {
  emptyHistory,
  recordEntry,
  redo as redoPure,
  undo as undoPure,
  type HistoryEntry,
  type HistoryResult,
  type HistoryState,
} from './history';

interface CommandHistoryStore extends HistoryState {
  /** Diagrama al que pertenece el historial; al cambiar de diagrama se descarta. */
  diagramId: string | null;
  /** Último error de deshacer/rehacer (para mostrarlo en la UI). */
  error: string | null;
  record: (
    diagramId: string,
    entry: Omit<HistoryEntry, 'afterApply' | 'afterUndo'>,
    modelAfter: UMLModel,
  ) => void;
  undo: (diagramId: string) => boolean;
  redo: (diagramId: string) => boolean;
  reset: () => void;
}

export const useCommandHistory = create<CommandHistoryStore>((set, get) => {
  const run = (diagramId: string, fn: typeof undoPure): boolean => {
    const s = get();
    if (s.diagramId !== diagramId) return false;
    if (!canEdit(useShareStore.getState().localRole)) {
      set({ error: 'Tu rol es de solo lectura: no puedes modificar el diagrama.' });
      return false;
    }
    const model = useModelStore.getState().model;
    if (!model) return false;
    const result: HistoryResult = fn({ undoStack: s.undoStack, redoStack: s.redoStack }, model);
    if (!result.ok) {
      set({ error: result.message });
      return false;
    }
    // El autosave atribuye la versión a la IA si la entrada era suya.
    if (result.entry.author === 'ai') markAiChange();
    useModelStore.getState().setModel(result.model);
    set({ ...result.state, error: null });
    return true;
  };

  return {
    ...emptyHistory(),
    diagramId: null,
    error: null,
    record: (diagramId, entry, modelAfter) => {
      const base = get().diagramId === diagramId ? get() : { ...emptyHistory() };
      const next = recordEntry({ undoStack: base.undoStack, redoStack: base.redoStack }, entry, modelAfter);
      set({ ...next, diagramId, error: null });
    },
    undo: (diagramId) => run(diagramId, undoPure),
    redo: (diagramId) => run(diagramId, redoPure),
    reset: () => set({ ...emptyHistory(), diagramId: null, error: null }),
  };
});
