import { create } from 'zustand';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface VersioningStore {
  saveState: SaveState;
  lastSavedAt: number | null;
  saveError: string | null;

  historyOpen: boolean;
  /** Se incrementa cuando se crea una versión, para que el panel abierto se refresque. */
  historyRefreshKey: number;

  setSaveState: (state: SaveState, error?: string | null) => void;
  markSaved: (versionCreated: boolean) => void;
  openHistory: () => void;
  closeHistory: () => void;
}

export const useVersioningStore = create<VersioningStore>((set) => ({
  saveState: 'idle',
  lastSavedAt: null,
  saveError: null,
  historyOpen: false,
  historyRefreshKey: 0,

  setSaveState: (saveState, error = null) => set({ saveState, saveError: error }),
  markSaved: (versionCreated) =>
    set((s) => ({
      saveState: 'saved',
      saveError: null,
      lastSavedAt: Date.now(),
      historyRefreshKey: versionCreated ? s.historyRefreshKey + 1 : s.historyRefreshKey,
    })),
  openHistory: () => set({ historyOpen: true }),
  closeHistory: () => set({ historyOpen: false }),
}));
