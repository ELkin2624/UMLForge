/**
 * features/sharing/model/invite-utils.ts
 * 
 * Utilidades para generación de room IDs y tokens de invitación.
 * 
 * NOTA DE SEGURIDAD: Los tokens son UUID v4 aleatorios generados en el cliente.
 * No tienen firma criptográfica server-side. Son identificadores de sesión
 * de prototipo. No confiar en ellos para autorización real.
 */

import type { InviteTokenConfig, Role } from './types';

/**
 * Genera un UUID v4 usando crypto.randomUUID() (disponible en browsers modernos
 * y en Node 14.17+).
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para entornos sin crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Genera un Room ID estable para un proyecto dado.
 * Formato: umlforge-{projectId} donde projectId es un UUID del proyecto.
 * 
 * Si no se proporciona projectId, genera uno nuevo y lo persiste en
 * sessionStorage para la sesión actual.
 */
export function getOrCreateRoomId(projectId?: string): string {
  const key = 'umlforge-project-id';
  let id = projectId;

  if (!id) {
    try {
      const stored = sessionStorage.getItem(key);
      id = stored || generateUUID();
      if (!stored) {
        sessionStorage.setItem(key, id);
      }
    } catch {
      id = generateUUID();
    }
  }

  return `umlforge-${id}`;
}

/**
 * Genera un token de invitación con el rol por defecto especificado.
 */
export function generateInviteToken(
  roomId: string,
  defaultRole: Exclude<Role, 'OWNER'>
): InviteTokenConfig {
  return {
    token: generateUUID(),
    defaultRole,
    createdAt: Date.now(),
    roomId,
  };
}

/**
 * Construye la URL de invitación completa.
 */
export function buildInviteUrl(
  roomId: string,
  token: string,
  baseUrl?: string
): string {
  const base = baseUrl ?? window.location.origin + window.location.pathname;
  const url = new URL(base);
  url.searchParams.set('room', roomId);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * Lee los parámetros de invitación de la URL actual.
 * Devuelve null si no hay parámetros de sala.
 */
export function parseInviteFromUrl(): { roomId: string; token: string } | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const token = params.get('token');
    if (room && token) {
      return { roomId: room, token };
    }
  } catch {
    // silent fail
  }
  return null;
}

/**
 * Limpia los parámetros de invitación de la URL (sin recargar la página).
 */
export function clearInviteParamsFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());
  } catch {
    // silent fail
  }
}
