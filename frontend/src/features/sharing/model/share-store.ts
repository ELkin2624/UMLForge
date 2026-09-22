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
import type {
  Role,
  GeneralAccessType,
  CollaboratorAccess,
  InviteTokenConfig,
  SharingState,
} from './types';
import { generateInviteToken } from './invite-utils';

const AVATAR_COLORS = [
  '#ea4335', // Google Red
  '#4285f4', // Google Blue
  '#fbbc05', // Google Yellow
  '#34a853', // Google Green
  '#9333ea', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

function getRandomColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

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
  /** Añade un usuario invitado por correo o nombre con un rol específico. */
  addCollaboratorByEmail: (
    emailOrName: string,
    role: Exclude<Role, 'OWNER'>
  ) => CollaboratorAccess;
  /** Cambia el rol de un colaborador o invitado por ID. Solo OWNER puede hacerlo. */
  changeCollaboratorRole: (id: string, newRole: Exclude<Role, 'OWNER'>) => void;
  /** Transfiere la propiedad a otro colaborador. */
  transferOwnership: (id: string) => void;
  /** Revoca el acceso de un colaborador o invitado. Solo OWNER puede hacerlo. */
  revokeCollaborator: (id: string) => void;
  /** ¿Está revocado este colaborador? */
  isRevoked: (id: string) => boolean;

  // ─── Acceso General (Google Docs style) ──────────────────────────────────
  setGeneralAccess: (type: GeneralAccessType) => void;
  setGeneralAccessRole: (role: Exclude<Role, 'OWNER'>) => void;

  // ─── Token de invitación ─────────────────────────────────────────────────
  /** Genera un nuevo token de invitación (o reemplaza el existente). */
  generateToken: (defaultRole?: Exclude<Role, 'OWNER'>) => InviteTokenConfig;
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
  invitedUsers: [],
  generalAccess: 'RESTRICTED',
  generalAccessRole: 'EDITOR',
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
        invitedUsers: [],
        generalAccess: 'RESTRICTED',
        generalAccessRole: 'EDITOR',
        inviteToken: null,
        revokedIds: new Set<string>(),
      }),

    joinSession: (roomId, role) =>
      set({
        roomId,
        localRole: role,
        collaborators: [],
        invitedUsers: [],
        inviteToken: null,
        revokedIds: new Set<string>(),
      }),

    endSession: () =>
      set({
        roomId: null,
        localRole: 'OWNER',
        collaborators: [],
        invitedUsers: [],
        generalAccess: 'RESTRICTED',
        generalAccessRole: 'EDITOR',
        inviteToken: null,
        revokedIds: new Set<string>(),
        isDialogOpen: false,
      }),

    setCollaborators: (collaborators) => set({ collaborators }),

    addCollaboratorByEmail: (emailOrName, role) => {
      const cleanInput = emailOrName.trim();
      const isEmail = cleanInput.includes('@');
      const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const name = isEmail ? cleanInput.split('@')[0] : cleanInput;
      const email = isEmail ? cleanInput : `${cleanInput.toLowerCase().replace(/\s+/g, '')}@ejemplo.com`;

      const newUser: CollaboratorAccess = {
        id,
        name,
        email,
        color: getRandomColor(cleanInput),
        role,
        isLocalOwner: false,
      };

      set((s) => ({
        invitedUsers: [...s.invitedUsers, newUser],
      }));

      return newUser;
    },

    changeCollaboratorRole: (id, newRole) =>
      set((s) => ({
        collaborators: s.collaborators.map((c) =>
          c.id === id ? { ...c, role: newRole } : c
        ),
        invitedUsers: s.invitedUsers.map((u) =>
          u.id === id ? { ...u, role: newRole } : u
        ),
      })),

    transferOwnership: (id) =>
      set((s) => ({
        localRole: 'EDITOR',
        collaborators: s.collaborators.map((c) =>
          c.id === id ? { ...c, role: 'OWNER' } : c
        ),
        invitedUsers: s.invitedUsers.map((u) =>
          u.id === id ? { ...u, role: 'OWNER' } : u
        ),
      })),

    revokeCollaborator: (id) =>
      set((s) => {
        const revokedIds = new Set(s.revokedIds);
        revokedIds.add(id);
        return {
          revokedIds,
          collaborators: s.collaborators.filter((c) => c.id !== id),
          invitedUsers: s.invitedUsers.filter((u) => u.id !== id),
        };
      }),

    isRevoked: (id) => get().revokedIds.has(id),

    setGeneralAccess: (generalAccess) => set({ generalAccess }),

    setGeneralAccessRole: (generalAccessRole) => set({ generalAccessRole }),

    generateToken: (defaultRole) => {
      const { roomId, generalAccessRole } = get();
      const roleToUse = defaultRole ?? generalAccessRole ?? 'EDITOR';
      const token = generateInviteToken(roomId ?? 'umlforge-default', roleToUse);
      set({ inviteToken: token });
      return token;
    },

    revokeToken: () => set({ inviteToken: null }),

    setLocalRole: (localRole) => set({ localRole }),
    setRoomId: (roomId) => set({ roomId }),
  }))
);
