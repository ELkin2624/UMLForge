/**
 * features/sharing/model/sharing.test.ts
 * 
 * Tests unitarios para el sistema de sharing: capacidades, roles, tokens,
 * store lifecycle, y revocación.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { canEdit, canShare, canManageAccess, canUseMutatingVoiceCommands } from './capabilities';
import { generateInviteToken, buildInviteUrl } from './invite-utils';
import { useShareStore } from './share-store';

// ─── Capabilities ────────────────────────────────────────────────────────────

describe('canEdit()', () => {
  it('returns true for OWNER', () => {
    expect(canEdit('OWNER')).toBe(true);
  });
  it('returns true for EDITOR', () => {
    expect(canEdit('EDITOR')).toBe(true);
  });
  it('returns false for READER', () => {
    expect(canEdit('READER')).toBe(false);
  });
});

describe('canShare()', () => {
  it('returns true only for OWNER', () => {
    expect(canShare('OWNER')).toBe(true);
    expect(canShare('EDITOR')).toBe(false);
    expect(canShare('READER')).toBe(false);
  });
});

describe('canManageAccess()', () => {
  it('returns true only for OWNER', () => {
    expect(canManageAccess('OWNER')).toBe(true);
    expect(canManageAccess('EDITOR')).toBe(false);
    expect(canManageAccess('READER')).toBe(false);
  });
});

describe('canUseMutatingVoiceCommands()', () => {
  it('returns true for OWNER and EDITOR', () => {
    expect(canUseMutatingVoiceCommands('OWNER')).toBe(true);
    expect(canUseMutatingVoiceCommands('EDITOR')).toBe(true);
  });
  it('returns false for READER', () => {
    expect(canUseMutatingVoiceCommands('READER')).toBe(false);
  });
});

// ─── Invite Utils ────────────────────────────────────────────────────────────

describe('generateInviteToken()', () => {
  it('generates a token with correct defaultRole', () => {
    const token = generateInviteToken('umlforge-test-room', 'EDITOR');
    expect(token.defaultRole).toBe('EDITOR');
    expect(token.roomId).toBe('umlforge-test-room');
    expect(token.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(token.createdAt).toBeGreaterThan(0);
  });

  it('generates a READER token', () => {
    const token = generateInviteToken('umlforge-abc', 'READER');
    expect(token.defaultRole).toBe('READER');
  });

  it('generates unique tokens on each call', () => {
    const t1 = generateInviteToken('room', 'EDITOR');
    const t2 = generateInviteToken('room', 'EDITOR');
    expect(t1.token).not.toBe(t2.token);
  });
});

describe('buildInviteUrl()', () => {
  it('builds URL with room and token params', () => {
    const url = buildInviteUrl('umlforge-abc123', 'my-token-uuid', 'http://localhost:5173/');
    expect(url).toContain('room=umlforge-abc123');
    expect(url).toContain('token=my-token-uuid');
  });
});

// ─── Share Store ─────────────────────────────────────────────────────────────

describe('useShareStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useShareStore.getState().endSession();
    useShareStore.setState({ isDialogOpen: false });
  });

  it('starts with localRole OWNER and no roomId', () => {
    const { localRole, roomId } = useShareStore.getState();
    expect(localRole).toBe('OWNER');
    expect(roomId).toBeNull();
  });

  it('startSession sets roomId and OWNER role', () => {
    useShareStore.getState().startSession('umlforge-test-123');
    const { roomId, localRole } = useShareStore.getState();
    expect(roomId).toBe('umlforge-test-123');
    expect(localRole).toBe('OWNER');
  });

  it('joinSession sets role from token defaultRole', () => {
    useShareStore.getState().joinSession('umlforge-test-abc', 'READER');
    const { roomId, localRole } = useShareStore.getState();
    expect(roomId).toBe('umlforge-test-abc');
    expect(localRole).toBe('READER');
  });

  it('endSession resets all state', () => {
    useShareStore.getState().startSession('umlforge-xyz');
    useShareStore.getState().endSession();
    const { roomId, localRole, collaborators, inviteToken } = useShareStore.getState();
    expect(roomId).toBeNull();
    expect(localRole).toBe('OWNER');
    expect(collaborators).toHaveLength(0);
    expect(inviteToken).toBeNull();
  });

  it('generateToken creates and stores an InviteTokenConfig', () => {
    useShareStore.getState().startSession('umlforge-test');
    const token = useShareStore.getState().generateToken('EDITOR');
    expect(token.defaultRole).toBe('EDITOR');
    expect(useShareStore.getState().inviteToken).toEqual(token);
  });

  it('revokeToken removes the current token', () => {
    useShareStore.getState().startSession('umlforge-test');
    useShareStore.getState().generateToken('READER');
    useShareStore.getState().revokeToken();
    expect(useShareStore.getState().inviteToken).toBeNull();
  });

  it('changeCollaboratorRole updates role for specific collaborator', () => {
    useShareStore.getState().startSession('umlforge-test');
    useShareStore.getState().setCollaborators([
      { id: 'user-1', name: 'Alice', color: '#f00', role: 'EDITOR' },
      { id: 'user-2', name: 'Bob', color: '#00f', role: 'READER' },
    ]);
    useShareStore.getState().changeCollaboratorRole('user-1', 'READER');
    const collaborators = useShareStore.getState().collaborators;
    const alice = collaborators.find((c) => c.id === 'user-1');
    expect(alice?.role).toBe('READER');
    // Bob unchanged
    const bob = collaborators.find((c) => c.id === 'user-2');
    expect(bob?.role).toBe('READER');
  });

  it('revokeCollaborator removes collaborator and marks as revoked', () => {
    useShareStore.getState().startSession('umlforge-test');
    useShareStore.getState().setCollaborators([
      { id: 'user-1', name: 'Alice', color: '#f00', role: 'EDITOR' },
    ]);
    useShareStore.getState().revokeCollaborator('user-1');
    expect(useShareStore.getState().collaborators).toHaveLength(0);
    expect(useShareStore.getState().isRevoked('user-1')).toBe(true);
    expect(useShareStore.getState().isRevoked('user-2')).toBe(false);
  });

  it('dialog open/close state', () => {
    expect(useShareStore.getState().isDialogOpen).toBe(false);
    useShareStore.getState().openShareDialog();
    expect(useShareStore.getState().isDialogOpen).toBe(true);
    useShareStore.getState().closeShareDialog();
    expect(useShareStore.getState().isDialogOpen).toBe(false);
  });

  it('addCollaboratorByEmail adds an invited user with chosen role', () => {
    useShareStore.getState().startSession('umlforge-test');
    const user = useShareStore
      .getState()
      .addCollaboratorByEmail('colaborador@ejemplo.com', 'READER');
    expect(user.email).toBe('colaborador@ejemplo.com');
    expect(user.role).toBe('READER');
    expect(useShareStore.getState().invitedUsers).toHaveLength(1);
    expect(useShareStore.getState().invitedUsers[0].role).toBe('READER');
  });

  it('setGeneralAccess and setGeneralAccessRole update access configuration', () => {
    useShareStore.getState().startSession('umlforge-test');
    expect(useShareStore.getState().generalAccess).toBe('RESTRICTED');
    useShareStore.getState().setGeneralAccess('ANYONE_WITH_LINK');
    expect(useShareStore.getState().generalAccess).toBe('ANYONE_WITH_LINK');

    useShareStore.getState().setGeneralAccessRole('READER');
    expect(useShareStore.getState().generalAccessRole).toBe('READER');
  });

  it('transferOwnership gives OWNER role to collaborator and makes local user EDITOR', () => {
    useShareStore.getState().startSession('umlforge-test');
    useShareStore.getState().setCollaborators([
      { id: 'user-bob', name: 'Bob', color: '#00f', role: 'EDITOR' },
    ]);
    expect(useShareStore.getState().localRole).toBe('OWNER');
    useShareStore.getState().transferOwnership('user-bob');
    expect(useShareStore.getState().localRole).toBe('EDITOR');
    const bob = useShareStore.getState().collaborators.find((c) => c.id === 'user-bob');
    expect(bob?.role).toBe('OWNER');
  });
});

describe('buildInviteUrl with role', () => {
  it('includes role query parameter when specified', () => {
    const urlReader = buildInviteUrl('room-1', 'tok-1', 'READER', 'http://localhost:5173/');
    expect(urlReader).toContain('role=READER');
    const urlEditor = buildInviteUrl('room-1', 'tok-1', 'EDITOR', 'http://localhost:5173/');
    expect(urlEditor).toContain('role=EDITOR');
  });
});
