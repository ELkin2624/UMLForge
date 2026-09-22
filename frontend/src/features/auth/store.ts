import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  username: string;
  email?: string;
  display_name: string | null;
}

export function getUserFallbackFromToken(token: string | null): User | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.sub && !payload.username) return null;
    return {
      id: payload.sub ? Number(payload.sub) : 0,
      username: payload.username || 'Usuario',
      email: payload.email,
      display_name: payload.username || 'Usuario',
    };
  } catch {
    return null;
  }
}

export interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user?: User | null) => void;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) =>
        set((state) => ({
          token,
          user: user ?? state.user ?? getUserFallbackFromToken(token),
        })),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
