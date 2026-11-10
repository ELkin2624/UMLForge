const raw = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

/** URL del backend sin barra final ni sufijo /api/v1. */
export const API_ORIGIN = raw.replace(/\/+$/, '');
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
