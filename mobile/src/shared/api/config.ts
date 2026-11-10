import * as SecureStore from 'expo-secure-store';

const KEY_SERVER_URL = 'umlforge.server_url';
const DEFAULT_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

let activeOrigin = DEFAULT_ORIGIN;

export function getApiOrigin(): string {
  return activeOrigin;
}

export function getApiBaseUrl(): string {
  return `${activeOrigin}/api/v1`;
}

export async function loadSavedApiOrigin(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(KEY_SERVER_URL);
    if (saved && saved.trim()) {
      activeOrigin = saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // fallback
  }
  return activeOrigin;
}

export async function setApiOrigin(newOrigin: string): Promise<void> {
  const clean = newOrigin.trim().replace(/\/+$/, '');
  activeOrigin = clean;
  try {
    await SecureStore.setItemAsync(KEY_SERVER_URL, clean);
  } catch {
    // ignore
  }
}

/** URL del backend sin barra final ni sufijo /api/v1 (dinámico). */
export const API_ORIGIN = activeOrigin;
export const API_BASE_URL = `${DEFAULT_ORIGIN}/api/v1`;
