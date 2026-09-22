import { useAuthStore } from '../features/auth/store';

const API_BASE_URL = '/api/v1';

export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Si expira en menos de 20 segundos, considerarlo expirado para refrescar proactivamente
    return payload.exp * 1000 < Date.now() + 20000;
  } catch {
    return true;
  }
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        const { access_token, user } = data;
        useAuthStore.getState().setAuth(access_token, user);
        return access_token;
      } else if (res.status === 401 || res.status === 403) {
        // Solo limpiar credenciales si el backend explícitamente las invalida
        useAuthStore.getState().clearAuth();
        return null;
      }
      return null;
    } catch (err) {
      // Error de red (ej. backend detenido o reiniciándose):
      // NO llamar a clearAuth() para no expulsar al usuario innecesariamente
      console.warn('[API Client] No se pudo contactar al servidor para refrescar token:', err);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let token = useAuthStore.getState().token;

  const isAuthEndpoint = path.startsWith('/auth/login') || path.startsWith('/auth/register');

  // Si hay un token y ya expiró, refrescar proactivamente antes de enviar la petición
  if (!isAuthEndpoint && token && isTokenExpired(token)) {
    const refreshedToken = await refreshToken();
    if (refreshedToken) {
      token = refreshedToken;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: options?.credentials || 'include',
      headers,
    });
  } catch (err: any) {
    // Si la conexión falló (backend temporalmente apagado)
    throw new Error(`No se pudo conectar con el servidor: ${err.message || 'Servidor no disponible'}`);
  }

  // Si devuelve 401 y no es petición a /auth/, reintentar una sola vez con nuevo token
  if (response.status === 401 && !path.startsWith('/auth/') && !(headers as Record<string, string>)['X-Retry']) {
    const newToken = await refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      headers['X-Retry'] = 'true';
      try {
        response = await fetch(url, {
          ...options,
          credentials: options?.credentials || 'include',
          headers,
        });
      } catch (retryErr: any) {
        throw new Error(`Error en reintento: ${retryErr.message}`);
      }
    }
  }

  if (!response.ok) {
    const rawText = await response.text();
    let errorDetail = rawText;
    try {
      const errorData = JSON.parse(rawText);
      errorDetail = errorData.detail?.message || errorData.detail || rawText;
    } catch {}
    throw new Error(errorDetail || `HTTP error! status: ${response.status}`);
  }

  // Si la respuesta es 204 No Content, no tiene body JSON
  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json();
}
