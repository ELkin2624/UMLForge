const API_BASE_URL = '/api/v1';

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

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
