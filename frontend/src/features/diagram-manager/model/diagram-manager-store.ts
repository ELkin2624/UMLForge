import { create } from 'zustand';
import { listDiagrams, type DiagramSummary } from '../../../api/diagrams-api';

interface DiagramManagerStore {
  open: boolean;
  diagrams: DiagramSummary[];
  loading: boolean;
  error: string | null;

  openManager: () => void;
  closeManager: () => void;
  setError: (error: string | null) => void;
  refresh: () => Promise<void>;
}

export const useDiagramManagerStore = create<DiagramManagerStore>((set) => ({
  open: false,
  diagrams: [],
  loading: false,
  error: null,

  openManager: () => set({ open: true }),
  closeManager: () => set({ open: false }),
  setError: (error) => set({ error }),
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      set({ diagrams: await listDiagrams(), loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'No se pudieron cargar los diagramas',
      });
    }
  },
}));
