import { useAuthStore } from '@/features/auth/store';

import { API_BASE_URL } from './config';

/** Decodifica base64url sin depender de `atob` (Hermes lo trae, pero así es testeable en node). */
function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(
    atob(padded)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (!payload.exp) return false;
    // Menos de 20 s de vida se considera expirado, para refrescar de forma proactiva.
    return payload.exp * 1000 < now + 20000;
  } catch {
    return true;
  }
}

let refreshPromise: Promise<string | null> | null = null;

/** Renueva el token con el refresh guardado cifrado en el dispositivo. */
export function refreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const savedRefreshToken = useAuthStore.getState().refreshToken;
      if (!savedRefreshToken) return null;
      const res = await fetch(`${API_BASE_URL}/auth/mobile/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: savedRefreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        useAuthStore.getState().setAuth(data.access_token, data.user, data.refresh_token);
        return data.access_token as string;
      }
      if (res.status === 401 || res.status === 403) useAuthStore.getState().clearAuth();
      return null;
    } catch {
      // Sin red: no expulsamos al usuario.
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readError(response: Response): Promise<string> {
  const raw = await response.text();
  try {
    const data = JSON.parse(raw);
    const detail = data.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    if (Array.isArray(detail)) return detail.map((d) => d.msg ?? String(d)).join('; ');
  } catch {
    // no era JSON
  }
  return raw || `Error HTTP ${response.status}`;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = useAuthStore.getState().token;
  const isAuthEndpoint = path.startsWith('/auth/');

  if (!isAuthEndpoint && token && isTokenExpired(token)) {
    const fresh = await refreshToken();
    if (fresh) token = fresh;
  }

  const send = (bearer: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    });

  let response: Response;
  try {
    response = await send(token);
  } catch (err) {
    throw new ApiError(
      `No se pudo conectar con el servidor (${err instanceof Error ? err.message : 'sin red'})`
    );
  }

  if (response.status === 401 && !path.startsWith('/auth/')) {
    const fresh = await refreshToken();
    if (fresh) {
      try {
        response = await send(fresh);
      } catch (err) {
        throw new ApiError(`Error en el reintento: ${err instanceof Error ? err.message : 'sin red'}`);
      }
    }
  }

  if (!response.ok) throw new ApiError(await readError(response), response.status);
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}
