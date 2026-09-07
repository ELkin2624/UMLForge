/**
 * features/sharing/model/capabilities.ts
 * 
 * Funciones de capacidades centralizadas para el control de acceso.
 * 
 * USO OBLIGATORIO: Usar SIEMPRE estas funciones para comprobar permisos.
 * No depender únicamente de botones disabled — aplicar también en:
 *   - Handlers del editor Apollon (mutations rechazadas)
 *   - VoiceAssistantPanel (mutaciones rechazadas con mensaje)
 *   - Keyboard shortcuts (interceptados en App)
 * 
 * NOTA: Control de acceso a nivel de aplicación (prototipo).
 * No existe autorización server-side real.
 */

import type { Role } from './types';

/**
 * ¿El usuario puede editar el diagrama?
 * OWNER y EDITOR: sí. READER: no.
 */
export function canEdit(role: Role): boolean {
  return role === 'OWNER' || role === 'EDITOR';
}

/**
 * ¿El usuario puede compartir / generar enlace de invitación?
 * Solo OWNER.
 */
export function canShare(role: Role): boolean {
  return role === 'OWNER';
}

/**
 * ¿El usuario puede gestionar el acceso (cambiar roles, revocar)?
 * Solo OWNER.
 */
export function canManageAccess(role: Role): boolean {
  return role === 'OWNER';
}

/**
 * ¿El usuario puede usar los comandos de voz para mutaciones?
 * OWNER y EDITOR: sí. READER: no.
 */
export function canUseMutatingVoiceCommands(role: Role): boolean {
  return canEdit(role);
}

/**
 * Mensaje estándar para lectores que intentan editar.
 */
export const READER_EDIT_BLOCKED_MESSAGE =
  'Modo lector activo: no puedes modificar el diagrama.';

export const READER_VOICE_BLOCKED_MESSAGE =
  'El modo lector no permite modificar el diagrama mediante comandos de voz.';
