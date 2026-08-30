import { create } from 'zustand';
import { UMLModel } from '../types/canonical-model';
import { E2EResult, E2EUiState } from '../types/api-responses';

export type DiagramViewType = 'class' | 'component';

interface ModelStore {
  model: UMLModel | null;
  diagramType: DiagramViewType;
  setModel: (model: UMLModel | null) => void;
  setDiagramType: (diagramType: DiagramViewType) => void;
  clearModel: () => void;

  // E2E UI State
  e2eState: E2EUiState;
  e2eResult: E2EResult | null;
  e2eError: string | null;
  e2eStartedAt: number | null;
  e2eCompletedAt: number | null;

  // Setters (pure actions)
  setE2EState: (state: E2EUiState) => void;
  setE2EResult: (result: E2EResult | null) => void;
  setE2EError: (error: string | null) => void;
  setE2EStartedAt: (time: number | null) => void;
  setE2ECompletedAt: (time: number | null) => void;
  resetE2E: () => void;
}

export const useModelStore = create<ModelStore>((set) => ({
  model: null,
  diagramType: 'class',
  setModel: (model) => set({ model }),
  setDiagramType: (diagramType) => set({ diagramType }),
  clearModel: () => set({ model: null }),

  // E2E UI State defaults
  e2eState: 'idle',
  e2eResult: null,
  e2eError: null,
  e2eStartedAt: null,
  e2eCompletedAt: null,

  setE2EState: (e2eState) => set({ e2eState }),
  setE2EResult: (e2eResult) => set({ e2eResult }),
  setE2EError: (e2eError) => set({ e2eError }),
  setE2EStartedAt: (e2eStartedAt) => set({ e2eStartedAt }),
  setE2ECompletedAt: (e2eCompletedAt) => set({ e2eCompletedAt }),
  resetE2E: () =>
    set({
      e2eState: 'idle',
      e2eResult: null,
      e2eError: null,
      e2eStartedAt: null,
      e2eCompletedAt: null,
    }),
}));

