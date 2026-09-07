/**
 * features/sharing/ui/ShareDialog.tsx
 * 
 * Diálogo de compartir estilo Google Docs.
 * Muestra: propietario, colaboradores con roles, enlace de invitación.
 * 
 * NOTA DE SEGURIDAD: Roles y tokens son control de acceso a nivel de aplicación
 * (prototipo). No existe autorización server-side real.
 * No usar ?role=owner como autoridad. Modificar la URL no otorga rol OWNER.
 */

import { useState, useCallback, useEffect } from 'react';
import { X, Copy, Check, Link2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useShareStore } from '../model/share-store';
import { useCollaboration } from '../../../hooks/use-collaboration';
import { useModelStore } from '../../../store/model-store';
import { CollaboratorList } from './CollaboratorList';
import { RoleSelector } from './RoleSelector';
import { canShare, canManageAccess } from '../model/capabilities';
import { buildInviteUrl, getOrCreateRoomId } from '../model/invite-utils';
import type { Role } from '../model/types';

export function ShareDialog() {
  const {
    isDialogOpen,
    closeShareDialog,
    localRole,
    collaborators,
    roomId,
    inviteToken,
    generateToken,
    revokeToken,
    changeCollaboratorRole,
    revokeCollaborator,
    startSession,
  } = useShareStore();

  const { connect, disconnect, status } = useCollaboration();
  const model = useModelStore((s) => s.model);

  const [linkCopied, setLinkCopied] = useState(false);
  const [defaultLinkRole, setDefaultLinkRole] = useState<Exclude<Role, 'OWNER'>>('EDITOR');

  const isConnected = status === 'connected' || status === 'synced';
  const isConnecting = status === 'connecting';
  const isOwner = canShare(localRole);
  const canManage = canManageAccess(localRole);

  const documentName = model?.name || 'Diagrama UML';

  // Generate invite URL from current token
  const inviteUrl = inviteToken
    ? buildInviteUrl(inviteToken.roomId, inviteToken.token)
    : null;

  const handleStartSharing = useCallback(() => {
    const newRoomId = getOrCreateRoomId();
    startSession(newRoomId);
    connect(newRoomId);
  }, [startSession, connect]);

  const handleStopSharing = useCallback(() => {
    disconnect();
    revokeToken();
    useShareStore.getState().endSession();
  }, [disconnect, revokeToken]);

  const handleGenerateLink = useCallback(() => {
    if (!roomId) return;
    generateToken(defaultLinkRole);
  }, [roomId, defaultLinkRole, generateToken]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea');
      el.value = inviteUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [inviteUrl]);

  const handleRevoke = useCallback((id: string) => {
    revokeCollaborator(id);
  }, [revokeCollaborator]);

  const handleChangeRole = useCallback((id: string, role: Exclude<Role, 'OWNER'>) => {
    changeCollaboratorRole(id, role);
  }, [changeCollaboratorRole]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDialogOpen) closeShareDialog();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isDialogOpen, closeShareDialog]);

  if (!isDialogOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="share-dialog-backdrop"
        onClick={closeShareDialog}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
      >
        {/* Header */}
        <div className="share-dialog__header">
          <div className="share-dialog__title-group">
            <h2 id="share-dialog-title" className="share-dialog__title">
              Compartir "{documentName}"
            </h2>
            {/* Connection status badge */}
            <span className={`share-dialog__status-badge share-dialog__status-badge--${status}`}>
              {isConnected ? (
                <><Wifi size={11} /> Conectado</>
              ) : isConnecting ? (
                <><RefreshCw size={11} className="share-dialog__spinner" /> Conectando...</>
              ) : (
                <><WifiOff size={11} /> Sin sesión</>
              )}
            </span>
          </div>
          <button
            className="share-dialog__close"
            onClick={closeShareDialog}
            aria-label="Cerrar diálogo"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="share-dialog__body">
          {/* If no active session, show start button */}
          {!roomId && (
            <div className="share-dialog__no-session">
              <p className="share-dialog__no-session-text">
                Aún no hay sesión colaborativa activa para este diagrama.
              </p>
              {isOwner && (
                <button
                  className="share-dialog__start-btn"
                  onClick={handleStartSharing}
                  disabled={isConnecting}
                  id="share-start-btn"
                >
                  {isConnecting ? (
                    <><RefreshCw size={14} className="share-dialog__spinner" /> Iniciando...</>
                  ) : (
                    'Iniciar sesión colaborativa'
                  )}
                </button>
              )}
            </div>
          )}

          {/* Active session content */}
          {roomId && (
            <>
              {/* Room info */}
              <div className="share-dialog__room-info">
                <span className="share-dialog__room-label">Sala:</span>
                <code className="share-dialog__room-id">{roomId}</code>
              </div>

              {/* Collaborators section */}
              <section className="share-dialog__section">
                <h3 className="share-dialog__section-title">Participantes</h3>
                <CollaboratorList
                  collaborators={collaborators}
                  localRole={localRole}
                  onChangeRole={handleChangeRole}
                  onRevoke={handleRevoke}
                />
              </section>

              {/* Invite link section (OWNER only) */}
              {canManage && (
                <section className="share-dialog__section">
                  <h3 className="share-dialog__section-title">Enlace de invitación</h3>

                  {/* Default role for link */}
                  <div className="share-dialog__link-role">
                    <label
                      className="share-dialog__link-role-label"
                      htmlFor="default-link-role"
                    >
                      Permiso predeterminado del enlace:
                    </label>
                    <RoleSelector
                      id="default-link-role"
                      value={defaultLinkRole}
                      onChange={setDefaultLinkRole}
                    />
                  </div>

                  {/* Link display */}
                  {inviteUrl ? (
                    <div className="share-dialog__link-box">
                      <input
                        className="share-dialog__link-input"
                        readOnly
                        value={inviteUrl}
                        aria-label="Enlace de invitación"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        className="share-dialog__copy-btn"
                        onClick={handleCopyLink}
                        aria-label="Copiar enlace"
                        title={linkCopied ? '¡Copiado!' : 'Copiar enlace'}
                        id="share-copy-link-btn"
                      >
                        {linkCopied ? <Check size={15} /> : <Copy size={15} />}
                        <span>{linkCopied ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      className="share-dialog__generate-btn"
                      onClick={handleGenerateLink}
                      id="share-generate-link-btn"
                    >
                      <Link2 size={14} />
                      <span>Generar enlace</span>
                    </button>
                  )}

                  {/* Revoke link */}
                  {inviteUrl && (
                    <button
                      className="share-dialog__revoke-link-btn"
                      onClick={revokeToken}
                      title="Invalidar el enlace actual"
                    >
                      Invalidar enlace
                    </button>
                  )}
                </section>
              )}

              {/* Stop sharing (OWNER only) */}
              {isOwner && (
                <button
                  className="share-dialog__stop-btn"
                  onClick={handleStopSharing}
                  id="share-stop-btn"
                >
                  Finalizar sesión colaborativa
                </button>
              )}
            </>
          )}

          {/* Security disclaimer */}
          <p className="share-dialog__security-note">
            🔒 Los roles son control de acceso a nivel de aplicación (prototipo).
            No existe autorización server-side real en esta versión.
          </p>
        </div>
      </div>
    </>
  );
}
