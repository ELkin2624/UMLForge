import { create } from 'zustand';
import { useModelStore } from '../../../store/model-store';
import { useShareStore } from '../../sharing/model/share-store';
import { canEdit } from '../../sharing/model/capabilities';
import {
  analyzeDataDesign,
  getDependencyDecisions,
  saveDependencyDecisions,
  type DataDesignResult,
  type DecisionStatus,
  type DependencyDecision,
} from '../api/data-design-api';
import { removeDecision, upsertDecision } from './decisions';

export type DataDesignTab = 'logical' | 'normalization' | 'diagram';

interface DataDesignStore {
  open: boolean;
  tab: DataDesignTab;
  loading: boolean;
  error: string | null;
  result: DataDesignResult | null;
  decisions: DependencyDecision[];
  /** Tabla seleccionada en la pestaña de normalización. */
  selectedTable: string | null;

  openDialog: () => Promise<void>;
  closeDialog: () => void;
  setTab: (tab: DataDesignTab) => void;
  selectTable: (table: string | null) => void;
  refresh: () => Promise<void>;
  decide: (table: string, lhs: string[], rhs: string[], status: DecisionStatus) => Promise<void>;
  undecide: (table: string, lhs: string[], rhs: string[]) => Promise<void>;
}

async function persist(decisions: DependencyDecision[]): Promise<void> {
  const roomId = useShareStore.getState().roomId;
  if (!roomId || !canEdit(useShareStore.getState().localRole)) return; // lectores: solo en memoria
  await saveDependencyDecisions(roomId, decisions);
}

export const useDataDesignStore = create<DataDesignStore>((set, get) => ({
  open: false,
  tab: 'logical',
  loading: false,
  error: null,
  result: null,
  decisions: [],
  selectedTable: null,

  openDialog: async () => {
    set({ open: true, error: null });
    const roomId = useShareStore.getState().roomId;
    if (roomId) {
      try {
        set({ decisions: await getDependencyDecisions(roomId) });
      } catch {
        // Sin decisiones guardadas o sin acceso: se analiza con lo que haya en memoria.
      }
    }
    await get().refresh();
  },

  closeDialog: () => set({ open: false }),
  setTab: (tab) => set({ tab }),
  selectTable: (selectedTable) => set({ selectedTable }),

  refresh: async () => {
    const model = useModelStore.getState().model;
    if (!model) {
      set({ result: null, error: 'Todavía no hay un modelo para analizar.' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const result = await analyzeDataDesign(model, get().decisions);
      const selected = get().selectedTable;
      set({
        result,
        loading: false,
        selectedTable:
          selected && result.normalization.some((t) => t.table === selected)
            ? selected
            : result.normalization[0]?.table ?? null,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'No se pudo analizar el modelo' });
    }
  },

  decide: async (table, lhs, rhs, status) => {
    const decisions = upsertDecision(get().decisions, table, lhs, rhs, status);
    set({ decisions });
    try {
      await persist(decisions);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo guardar la decisión' });
    }
    await get().refresh();
  },

  undecide: async (table, lhs, rhs) => {
    const decisions = removeDecision(get().decisions, table, lhs, rhs);
    set({ decisions });
    try {
      await persist(decisions);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo guardar la decisión' });
    }
    await get().refresh();
  },
}));
