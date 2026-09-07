import { useAuthStore } from '../features/auth/store';

const API_BASE_URL = '/api/v1';

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = useAuthStore.getState().token;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  let response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && !(headers as Record<string, string>)['X-Retry']) {
    try {
      // Intentar refrescar token
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST' });
      if (refreshRes.ok) {
        const { access_token } = await refreshRes.json();
        const authStore = useAuthStore.getState();
        authStore.setAuth(access_token, authStore.user!);
        
        // Reintentar request original con nuevo token
        headers['Authorization'] = `Bearer ${access_token}`;
        headers['X-Retry'] = 'true';
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        useAuthStore.getState().clearAuth();
      }
    } catch {
      useAuthStore.getState().clearAuth();
    }
  }

  if (!response.ok) {
    let errorDetail = 'Error desconocido';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail?.message || errorData.detail || JSON.stringify(errorData);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail || `HTTP error! status: ${response.status}`);
  }

  // Si esperamos un Blob (ej. descarga de ZIP), no parseamos JSON. 
  // Models-api lo manejará devolviendo response.blob() en lugar de request() para generadores.
  return response.json();
}
