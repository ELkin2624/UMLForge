import { create } from 'zustand';

import { clearSession, loadSession, saveSession } from '@/shared/api/token-storage';

export interface User {
  id: number;
  username: string;
  email?: string;
  display_name: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  /** false hasta leer el almacenamiento seguro al arrancar. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setAuth: (token: string, user?: User | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,
  hydrate: async () => {
    const saved = await loadSession();
    set({ token: saved?.token ?? null, user: saved?.user ?? null, hydrated: true });
  },
  setAuth: (token, user) => {
    const nextUser = user ?? get().user;
    set({ token, user: nextUser });
    if (nextUser) void saveSession({ token, user: nextUser });
  },
  clearAuth: () => {
    set({ token: null, user: null });
    void clearSession();
  },
}));
