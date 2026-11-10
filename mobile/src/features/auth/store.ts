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
  refreshToken: string | null;
  user: User | null;
  /** false hasta leer el almacenamiento seguro al arrancar. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setAuth: (token: string, user?: User | null, refreshToken?: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  hydrate: async () => {
    const saved = await loadSession();
    set({
      token: saved?.token ?? null,
      refreshToken: saved?.refreshToken ?? null,
      user: saved?.user ?? null,
      hydrated: true,
    });
  },
  setAuth: (token, user, refreshToken) => {
    const nextUser = user ?? get().user;
    const nextRefreshToken = refreshToken ?? get().refreshToken;
    set({ token, refreshToken: nextRefreshToken, user: nextUser });
    if (nextUser && nextRefreshToken) void saveSession({ token, refreshToken: nextRefreshToken, user: nextUser });
  },
  clearAuth: () => {
    set({ token: null, refreshToken: null, user: null });
    void clearSession();
  },
}));
