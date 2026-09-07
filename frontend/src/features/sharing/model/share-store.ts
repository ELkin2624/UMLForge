/**
 * features/sharing/model/share-store.ts
 * 
 * Zustand store para el estado de compartir.
 * Gestiona: rol local, colaboradores, tokens de invitación, revocaciones.
 * 
 * NOTA: Separado intencionalmente de features/collaboration para mantener
 * responsabilidades claras:
 *   - collaboration: Y.Doc, WebSocket, Awareness, presence, sync
 *   - sharing: owner, editor, reader, invite, permissions, access management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Role, CollaboratorAccess, InviteTokenConfig, SharingState } from './types';
import { generateInviteToken } from './invite-utils';

interface ShareStore extends SharingState {
  // ─── Acciones del diálogo ────────────────────────────────────────────────
  openShareDialog: () => void;
  closeShareDialog: () => void;

  // ─── Acciones de sesión ──────────────────────────────────────────────────
  /** Inicia una sesión de compartir. El usuario local es OWNER. */
  startSession: (roomId: string) => void;
  /** Únirse a sesión existente con el rol asignado por el token. */
  joinSession: (roomId: string, role: Exclude<Role, 'OWNER'>) => void;
  /** Salir de la sesión colaborativa. Resetea el estado. */
  endSession: () => void;

  // ─── Acciones de colaboradores ───────────────────────────────────────────
  /** Actualiza la lista completa de colaboradores (llamar desde presence). */
  setCollaborators: (collaborators: CollaboratorAccess[]) => void;
  /** Cambia el rol de un colaborador por ID. Solo OWNER puede hacerlo. */
  changeCollaboratorRole: (id: string, newRole: Exclude<Role, 'OWNER'>) => void;
  /** Revoca el acceso de un colaborador. Solo OWNER puede hacerlo. */
  revokeCollaborator: (id: string) => void;
  /** ¿Está revocado este colaborador? */
  isRevoked: (id: string) => boolean;

  // ─── Token de invitación ─────────────────────────────────────────────────
  /** Genera un nuevo token de invitación (o reemplaza el existente). */
  generateToken: (defaultRole: Exclude<Role, 'OWNER'>) => InviteTokenConfig;
  /** Invalida el token actual. */
  revokeToken: () => void;

  // ─── Setters individuales ────────────────────────────────────────────────
  setLocalRole: (role: Role) => void;
  setRoomId: (roomId: string | null) => void;
}

const DEFAULT_STATE: SharingState = {
  isDialogOpen: false,
  roomId: null,
  localRole: 'OWNER',
  collaborators: [],
  inviteToken: null,
  revokedIds: new Set<string>(),
};

export const useShareStore = create<ShareStore>()(
  subscribeWithSelector((set, get) => ({
    ...DEFAULT_STATE,

    openShareDialog: () => set({ isDialogOpen: true }),
    closeShareDialog: () => set({ isDialogOpen: false }),

    startSession: (roomId) =>
      set({
        roomId,
        localRole: 'OWNER',
        collaborators: [],
        inviteToken: null,
        revokedIds: new Set<string>(),
      }),

    joinSession: (roomId, role) =>
      set({
        roomId,
        localRole: role,
        collaborators: [],
        inviteToken: null,
        revokedIds: new Set<string>(),
      }),

    endSession: () =>
      set({
        roomId: null,
        localRole: 'OWNER',
        collaborators: [],
        inviteToken: null,
        revokedIds: new Set<string>(),
        isDialogOpen: false,
      }),

    setCollaborators: (collaborators) => set({ collaborators }),

    changeCollaboratorRole: (id, newRole) =>
      set((s) => ({
        collaborators: s.collaborators.map((c) =>
          c.id === id ? { ...c, role: newRole } : c
        ),
      })),

    revokeCollaborator: (id) =>
      set((s) => {
        const revokedIds = new Set(s.revokedIds);
        revokedIds.add(id);
        return {
          revokedIds,
          collaborators: s.collaborators.filter((c) => c.id !== id),
        };
      }),

    isRevoked: (id) => get().revokedIds.has(id),

    generateToken: (defaultRole) => {
      const { roomId } = get();
      const token = generateInviteToken(roomId ?? 'umlforge-default', defaultRole);
      set({ inviteToken: token });
      return token;
    },

    revokeToken: () => set({ inviteToken: null }),

    setLocalRole: (localRole) => set({ localRole }),
    setRoomId: (roomId) => set({ roomId }),
  }))
);
