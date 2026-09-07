/**
 * features/sharing/model/types.ts
 * 
 * Tipos para el sistema de compartir y roles de UMLForge.
 * 
 * NOTA DE SEGURIDAD: Los roles (OWNER, EDITOR, READER) son control de
 * acceso a nivel de aplicación (prototipo). No existe autorización
 * server-side real. Modificar la URL no convierte a ningún usuario en OWNER.
 */

export type Role = 'OWNER' | 'EDITOR' | 'READER';

export interface CollaboratorAccess {
  /** Identificador único del colaborador (Yjs clientId o UUID) */
  id: string;
  /** Nombre visible */
  name: string;
  /** Color de presencia */
  color: string;
  /** Rol asignado en esta sesión */
  role: Role;
  /** Si es el propietario local de esta sesión */
  isLocalOwner?: boolean;
}

export interface InviteTokenConfig {
  /** Token de invitación (UUID generado localmente) */
  token: string;
  /** Rol por defecto para usuarios que usen este enlace */
  defaultRole: Exclude<Role, 'OWNER'>;
  /** Timestamp de creación */
  createdAt: number;
  /** Room ID asociada */
  roomId: string;
}

export interface SharingState {
  /** Si el panel de compartir está abierto */
  isDialogOpen: boolean;
  /** Room ID actual (null = sin sesión activa) */
  roomId: string | null;
  /** Rol del usuario local en la sesión actual */
  localRole: Role;
  /** Colaboradores conectados con sus roles */
  collaborators: CollaboratorAccess[];
  /** Token de invitación actual (null = no generado aún) */
  inviteToken: InviteTokenConfig | null;
  /** IDs de colaboradores revocados (no pueden participar) */
  revokedIds: Set<string>;
}
