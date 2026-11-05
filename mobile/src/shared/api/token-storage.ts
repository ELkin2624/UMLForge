import * as SecureStore from 'expo-secure-store';

const KEY = 'umlforge.session';

export interface StoredSession {
  token: string;
  user: { id: number; username: string; email?: string; display_name: string | null };
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  } catch {
    // Sin almacenamiento seguro: la sesión vive solo en memoria.
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // nada que limpiar
  }
}
