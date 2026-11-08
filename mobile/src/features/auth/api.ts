import { request } from '@/shared/api/client';
import { useAuthStore } from '@/features/auth/store';

import type { User } from './store';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: User | null;
}

export function login(identifier: string, password: string) {
  return request<TokenResponse>('/auth/mobile/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export function register(input: {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}) {
  return request<User>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchMe() {
  return request<User>('/auth/me');
}

export async function logout(): Promise<void> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return;
  try {
    await request('/auth/mobile/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // Cerrar sesión local aunque el servidor no responda.
  }
}
