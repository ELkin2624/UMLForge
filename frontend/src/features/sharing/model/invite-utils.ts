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
 * Acepta tanto (roomId, token, role, baseUrl) como (roomId, token, baseUrl).
 */
export function buildInviteUrl(
  roomId: string,
  token: string,
  roleOrBaseUrl?: Exclude<Role, 'OWNER'> | string,
  baseUrl?: string
): string {
  let role: Exclude<Role, 'OWNER'> | undefined;
  let base = baseUrl;

  if (roleOrBaseUrl === 'READER' || roleOrBaseUrl === 'EDITOR') {
    role = roleOrBaseUrl;
  } else if (typeof roleOrBaseUrl === 'string') {
    base = roleOrBaseUrl;
  }

  const defaultOrigin =
    typeof window !== 'undefined' && window.location
      ? window.location.origin + window.location.pathname
      : 'http://localhost:5173/';
  const finalBase = base ?? defaultOrigin;
  const url = new URL(finalBase);
  url.searchParams.set('room', roomId);
  url.searchParams.set('token', token);
  if (role) {
    url.searchParams.set('role', role);
  }
  return url.toString();
}

/**
 * Lee los parámetros de invitación de la URL actual.
 * Soporta dos formatos:
 * 1. ?room=<roomId>&token=<token>&role=<role>  (enlace legacy desde ShareDialog)
 * 2. ?invite=<invitationId>                    (deep-link desde notificaciones)
 */
export function parseInviteFromUrl(): {
  roomId: string;
  token: string;
  role?: Exclude<Role, 'OWNER'>;
  invitationId?: number;
} | null {
  try {
    const params = new URLSearchParams(window.location.search);

    // Formato 2: deep-link ?invite=<invitationId>
    const inviteIdStr = params.get('invite');
    if (inviteIdStr) {
      const invitationId = parseInt(inviteIdStr, 10);
      if (!isNaN(invitationId)) {
        return { roomId: '', token: '', invitationId };
      }
    }

    // Formato 1: legacy ?room=...&token=...
    const room = params.get('room');
    const token = params.get('token');
    const rawRole = params.get('role');
    const role: Exclude<Role, 'OWNER'> | undefined =
      rawRole === 'READER' || rawRole === 'EDITOR' ? rawRole : undefined;

    if (room && token) {
      return { roomId: room, token, role };
    }
  } catch {
    // silent fail
  }
  return null;
}

/**
 * Construye una URL de deep-link para una invitación específica del backend.
 * Formato: <origin>/?invite=<invitationId>
 * El usuario abre esta URL, hace login si es necesario, y la app
 * llama a /api/v1/invitations/<id>/accept con el JWT del usuario.
 */
export function buildInvitationDeepLink(invitationId: number): string {
  const base =
    typeof window !== 'undefined' && window.location
      ? window.location.origin + window.location.pathname
      : 'http://localhost:5173/';
  const url = new URL(base);
  url.searchParams.set('invite', invitationId.toString());
  return url.toString();
}

/**
 * Limpia los parámetros de invitación de la URL (sin recargar la página).
 */
export function clearInviteParamsFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('token');
    url.searchParams.delete('role');
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());
  } catch {
    // silent fail
  }
}
