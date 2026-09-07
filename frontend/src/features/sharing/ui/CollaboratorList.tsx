/**
 * features/sharing/ui/CollaboratorList.tsx
 * 
 * Lista de colaboradores activos con sus roles.
 * Permite al OWNER cambiar roles y revocar acceso.
 */

import { UserX } from 'lucide-react';
import { RoleSelector } from './RoleSelector';
import type { CollaboratorAccess, Role } from '../model/types';
import { canManageAccess } from '../model/capabilities';

interface CollaboratorListProps {
  collaborators: CollaboratorAccess[];
  localRole: Role;
  onChangeRole: (id: string, role: Exclude<Role, 'OWNER'>) => void;
  onRevoke: (id: string) => void;
}

export function CollaboratorList({
  collaborators,
  localRole,
  onChangeRole,
  onRevoke,
}: CollaboratorListProps) {
  const isManager = canManageAccess(localRole);

  if (collaborators.length === 0) {
    return (
      <p className="share-dialog__empty">
        Solo tú estás en esta sesión. Comparte el enlace para colaborar.
      </p>
    );
  }

  return (
    <ul className="share-dialog__collaborators" role="list" aria-label="Colaboradores">
      {collaborators.map((collaborator) => (
        <li key={collaborator.id} className="share-dialog__collaborator">
          {/* Avatar */}
          <span
            className="share-dialog__avatar"
            style={{ backgroundColor: collaborator.color }}
            aria-hidden="true"
          >
            {collaborator.name.charAt(0).toUpperCase()}
          </span>

          {/* Name + role info */}
          <span className="share-dialog__collaborator-info">
            <span className="share-dialog__collaborator-name">{collaborator.name}</span>
            {collaborator.isLocalOwner && (
              <span className="share-dialog__owner-badge">Tú · Propietario</span>
            )}
          </span>

          {/* Role selector (OWNER only) or role label */}
          {isManager && !collaborator.isLocalOwner ? (
            <RoleSelector
              id={`role-${collaborator.id}`}
              value={collaborator.role as Exclude<Role, 'OWNER'>}
              onChange={(role) => onChangeRole(collaborator.id, role)}
            />
          ) : (
            <span className="share-dialog__role-label">
              {collaborator.role === 'OWNER'
                ? 'Propietario'
                : collaborator.role === 'EDITOR'
                ? 'Editor'
                : 'Lector'}
            </span>
          )}

          {/* Revoke button (OWNER only, not self) */}
          {isManager && !collaborator.isLocalOwner && (
            <button
              className="share-dialog__revoke-btn"
              onClick={() => onRevoke(collaborator.id)}
              aria-label={`Revocar acceso de ${collaborator.name}`}
              title="Revocar acceso"
            >
              <UserX size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
