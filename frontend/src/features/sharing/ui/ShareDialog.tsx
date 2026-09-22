/**
 * features/sharing/ui/ShareDialog.tsx
 * 
 * Diálogo de compartir con UI/UX idéntica a Google Docs + GitHub Autocomplete.
 * Permite buscar usuarios reales en PostgreSQL con debounce de 300ms,
 * enviar invitaciones autoritativas atómicas, listar colaboradores reales con
 * estados (OWNER, EDITOR, READER, PENDING), gestionar roles y cancelaciones.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  X,
  HelpCircle,
  Settings,
  Lock,
  Globe,
  Link2,
  Check,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useShareStore } from '../model/share-store';
import { useCollaboration } from '../../../hooks/use-collaboration';
import { useModelStore } from '../../../store/model-store';
import { useAuthStore } from '../../auth/store';
import { canManageAccess } from '../model/capabilities';
import { buildInviteUrl } from '../model/invite-utils';
import { request } from '../../../api/client';
import type { Role, GeneralAccessType } from '../model/types';

interface UserSearchResult {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ApiCollaborator {
  user_id: number;
  username: string;
  display_name: string | null;
  role: string;
  is_pending: boolean;
  invitation_id?: number | null;
}

export function ShareDialog() {
  const {
    isDialogOpen,
    closeShareDialog,
    localRole,
    generalAccess,
    generalAccessRole,
    roomId,
    inviteToken,
    generateToken,
    setGeneralAccess,
    setGeneralAccessRole,
    startSession,
  } = useShareStore();

  const { connect } = useCollaboration();
  const model = useModelStore((s) => s.model);
  const authUser = useAuthStore((s) => s.user);

  // Estados locales
  const [inviteInput, setInviteInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [inviteRole, setInviteRole] = useState<Exclude<Role, 'OWNER'>>('EDITOR');
  const [collaboratorsList, setCollaboratorsList] = useState<ApiCollaborator[]>([]);

  const [linkCopied, setLinkCopied] = useState(false);
  const [showSettingsNotice, setShowSettingsNotice] = useState(false);
  const [showHelpNotice, setShowHelpNotice] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ID del diagrama activo. Siempre corresponde al ID numérico del diagrama en PostgreSQL.
  const diagramId = roomId || (typeof window !== 'undefined' ? sessionStorage.getItem('umlforge-active-diagram') : null);

  // Cargar lista real de colaboradores
  const fetchCollaborators = useCallback(async () => {
    if (!diagramId) return;
    try {
      const data = await request<ApiCollaborator[]>(`/diagrams/${diagramId}/collaborators`);
      setCollaboratorsList(data);
    } catch (err: any) {
      console.warn('No se pudieron obtener colaboradores remotos:', err);
    }
  }, [diagramId]);

  useEffect(() => {
    if (isDialogOpen) {
      fetchCollaborators();
    }
  }, [isDialogOpen, fetchCollaborators]);

  // Asegurar que la sesión colaborativa sobre este diagrama esté activa y conectada al abrir Compartir
  useEffect(() => {
    if (isDialogOpen && diagramId) {
      try {
        sessionStorage.setItem('umlforge-collab-active', 'true');
        sessionStorage.setItem('umlforge-active-diagram', diagramId);
      } catch {}

      if (roomId !== diagramId) {
        startSession(diagramId);
      }
      connect(diagramId);

      if (!inviteToken) {
        generateToken(generalAccessRole);
      }
    }
  }, [isDialogOpen, diagramId, roomId, inviteToken, startSession, connect, generateToken, generalAccessRole]);

  // Debounce 300ms para búsqueda de usuarios
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInviteInput(value);
    setSelectedUser(null);
    setFeedback(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await request<UserSearchResult[]>(
            `/users/search?q=${encodeURIComponent(value.trim())}&limit=10`
          );
          setSearchResults(results);
          setShowDropdown(true);
        } catch (err) {
          console.error('Error buscando usuarios:', err);
          setSearchResults([]);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  // Seleccionar usuario desde el dropdown
  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setInviteInput(user.display_name || user.username);
    setShowDropdown(false);
    setFeedback(null);
  };

  // Enviar invitación a usuario
  const handleSendInvitation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inviteInput.trim()) return;
    if (!diagramId) {
      setFeedback({ type: 'error', message: 'No hay un diagrama activo para compartir.' });
      return;
    }

    setFeedback(null);
    try {
      const payload: { user_id?: number; identifier?: string; role: string } = {
        role: inviteRole,
      };

      if (selectedUser) {
        payload.user_id = selectedUser.id;
      } else {
        payload.identifier = inviteInput.trim();
      }

      await request(`/diagrams/${diagramId}/invitations`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setFeedback({
        type: 'success',
        message: `Invitación enviada a ${selectedUser?.username || inviteInput.trim()} como ${inviteRole === 'EDITOR' ? 'Editor' : 'Lector'}.`,
      });
      setInviteInput('');
      setSelectedUser(null);
      setShowDropdown(false);
      fetchCollaborators();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al enviar la invitación.',
      });
    }
  };

  // Modificar rol o cancelar/revocar
  const handleCollaboratorAction = async (collab: ApiCollaborator, actionValue: string) => {
    if (!diagramId) return;
    setFeedback(null);
    try {
      if (actionValue === '__CANCEL_INVITATION__' && collab.invitation_id) {
        await request(`/diagrams/${diagramId}/invitations/${collab.invitation_id}/cancel`, {
          method: 'POST',
        });
        setFeedback({ type: 'success', message: 'Invitación cancelada correctamente.' });
      } else if (actionValue === '__REMOVE__') {
        await request(`/diagrams/${diagramId}/collaborators/${collab.user_id}`, {
          method: 'DELETE',
        });
        setFeedback({ type: 'success', message: `Acceso revocado a ${collab.username}.` });
      } else if (actionValue === 'EDITOR' || actionValue === 'READER') {
        await request(`/diagrams/${diagramId}/collaborators/${collab.user_id}`, {
          method: 'PUT',
          body: JSON.stringify({ role: actionValue }),
        });
        setFeedback({ type: 'success', message: `Rol actualizado a ${actionValue === 'EDITOR' ? 'Editor' : 'Lector'}.` });
      }
      fetchCollaborators();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar el colaborador.',
      });
    }
  };

  // Propietario (usuario actual)
  const ownerName = authUser?.display_name || authUser?.username || 'Propietario';
  const ownerEmail = authUser?.email || '';
  const ownerInitials = useMemo(() => {
    const parts = ownerName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return ownerName.substring(0, 2).toUpperCase();
  }, [ownerName]);

  const documentName = model?.name || 'Parcial1-SW1';
  const canManage = canManageAccess(localRole);

  // URL de invitación
  const effectiveRole = generalAccess === 'ANYONE_WITH_LINK' ? generalAccessRole : undefined;
  const inviteUrl = useMemo(() => {
    if (!roomId) return '';
    const tokenStr = inviteToken ? inviteToken.token : 'default';
    return buildInviteUrl(roomId, tokenStr, effectiveRole);
  }, [roomId, inviteToken, effectiveRole]);

  // Manejador para copiar enlace
  const handleCopyLink = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = inviteUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  }, [inviteUrl]);

  // Cerrar con Escape
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
      {/* Backdrop oscuro */}
      <div
        className="gdocs-backdrop"
        onClick={closeShareDialog}
        aria-hidden="true"
      />

      {/* Modal Card Google Docs */}
      <div
        className="gdocs-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gdocs-dialog-title"
      >
        {/* Encabezado */}
        <div className="gdocs-header">
          <h2 id="gdocs-dialog-title" className="gdocs-title" title={`Compartir "${documentName}"`}>
            Compartir "{documentName}"
          </h2>
          <div className="gdocs-header-actions">
            <button
              className="gdocs-icon-btn"
              title="Ayuda sobre cómo compartir"
              onClick={() => setShowHelpNotice((v) => !v)}
              aria-label="Ayuda"
            >
              <HelpCircle size={19} />
            </button>
            <button
              className="gdocs-icon-btn"
              title="Configuración de uso compartido"
              onClick={() => setShowSettingsNotice((v) => !v)}
              aria-label="Ajustes"
            >
              <Settings size={19} />
            </button>
            <button
              className="gdocs-icon-btn"
              title="Cerrar"
              onClick={closeShareDialog}
              aria-label="Cerrar diálogo"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Notificaciones de ayuda / configuración */}
        {showHelpNotice && (
          <div style={{ margin: '0 20px 10px', padding: '10px 14px', background: '#e0f2fe', border: '1.5px solid #1a1a1a', borderRadius: '10px', fontSize: '12px', color: '#0369a1', boxShadow: '2px 2px 0 #1a1a1a', fontWeight: 600 }}>
            💡 <strong>Ayuda:</strong> Busca personas por su nombre de usuario. Puedes otorgarles rol de <strong>Editor</strong> (mutaciones en tiempo real) o <strong>Lector</strong> (solo visualización). Al aceptar tu invitación, tendrán acceso inmediato.
          </div>
        )}

        {showSettingsNotice && (
          <div style={{ margin: '0 20px 10px', padding: '10px 14px', background: '#fef3c7', border: '1.5px solid #1a1a1a', borderRadius: '10px', fontSize: '12px', color: '#92400e', boxShadow: '2px 2px 0 #1a1a1a', fontWeight: 600 }}>
            ⚙️ <strong>Seguridad Autorizada:</strong> Todas las operaciones de mutación se validan estrictamente en el backend. Los lectores tienen el lienzo bloqueado y sus peticiones HTTP / WebSocket son rechazadas.
          </div>
        )}

        {feedback && (
          <div style={{ margin: '0 20px 10px' }} className={`gdocs-alert-toast ${feedback.type === 'error' ? 'gdocs-alert-error' : 'gdocs-alert-success'}`}>
            {feedback.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Cuerpo del Diálogo */}
        <div className="gdocs-body">
          {/* Autocomplete de búsqueda de personas estilo GitHub / Google Docs */}
          <div className="gdocs-search-container" ref={dropdownRef}>
            <form className="gdocs-input-box" onSubmit={handleSendInvitation}>
              <input
                type="text"
                className="gdocs-text-input"
                placeholder="Añadir personas por username o nombre..."
                value={inviteInput}
                onChange={handleInputChange}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                aria-label="Añadir personas"
              />
              {inviteInput.trim().length > 0 && (
                <>
                  <select
                    className="gdocs-input-role-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Exclude<Role, 'OWNER'>)}
                    aria-label="Rol para la nueva invitación"
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="READER">Lector</option>
                  </select>
                  <button
                    type="submit"
                    className="gdocs-add-btn"
                    disabled={!inviteInput.trim()}
                  >
                    Invitar
                  </button>
                </>
              )}
            </form>

            {/* Dropdown de resultados de búsqueda */}
            {showDropdown && searchResults.length > 0 && (
              <ul className="gdocs-autocomplete-dropdown">
                {searchResults.map((u) => {
                  const initials = (u.display_name || u.username).substring(0, 2).toUpperCase();
                  return (
                    <li
                      key={u.id}
                      className="gdocs-autocomplete-item"
                      onClick={() => handleSelectUser(u)}
                    >
                      <div className="gdocs-avatar" style={{ backgroundColor: '#bae6fd', width: 28, height: 28, fontSize: 11 }}>
                        {initials}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>
                          {u.display_name || u.username}
                        </span>
                        <span style={{ fontSize: '11px', color: '#666666' }}>
                          @{u.username}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Sección: Personas con acceso */}
          <div>
            <h3 className="gdocs-section-title">Personas con acceso</h3>
            <ul className="gdocs-user-list">
              {/* Si hay lista cargada del backend */}
              {collaboratorsList.length > 0 ? (
                collaboratorsList.map((c) => {
                  const isOwnerRow = c.role === 'OWNER';
                  const initials = (c.display_name || c.username).substring(0, 2).toUpperCase();
                  return (
                    <li key={c.user_id} className="gdocs-user-row">
                      <div className="gdocs-user-left">
                        <div
                          className="gdocs-avatar"
                          style={{ backgroundColor: isOwnerRow ? '#f7d273' : c.is_pending ? '#fcb580' : '#bae6fd' }}
                        >
                          {initials}
                        </div>
                        <div className="gdocs-user-details">
                          <span className="gdocs-user-name">
                            {c.display_name || c.username} {c.user_id === authUser?.id ? '(tú)' : ''}
                          </span>
                          <span className="gdocs-user-email">
                            @{c.username}
                          </span>
                        </div>
                      </div>

                      {/* Estado y rol */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {c.is_pending && (
                          <span className="gdocs-badge-pending">
                            <Clock size={12} /> Pendiente
                          </span>
                        )}

                        {isOwnerRow ? (
                          <span className="gdocs-owner-label">Propietario</span>
                        ) : canManage ? (
                          <select
                            className="gdocs-role-select"
                            value={c.role}
                            onChange={(e) => handleCollaboratorAction(c, e.target.value)}
                            aria-label={`Permiso para ${c.username}`}
                          >
                            <option value="READER">Lector</option>
                            <option value="EDITOR">Editor</option>
                            {c.is_pending ? (
                              <option value="__CANCEL_INVITATION__">Cancelar invitación</option>
                            ) : (
                              <option value="__REMOVE__">Quitar acceso</option>
                            )}
                          </select>
                        ) : (
                          <span className="gdocs-owner-label">
                            {c.role === 'EDITOR' ? 'Editor' : 'Lector'}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })
              ) : (
                /* Fallback cuando es local o cargando */
                <li className="gdocs-user-row">
                  <div className="gdocs-user-left">
                    <div className="gdocs-avatar" style={{ backgroundColor: '#f7d273' }}>
                      {ownerInitials}
                    </div>
                    <div className="gdocs-user-details">
                      <span className="gdocs-user-name">
                        {ownerName} (tú)
                      </span>
                      <span className="gdocs-user-email">{ownerEmail}</span>
                    </div>
                  </div>
                  <span className="gdocs-owner-label">Propietario</span>
                </li>
              )}
            </ul>
          </div>

          {/* Sección: Acceso general */}
          <div>
            <h3 className="gdocs-section-title">Acceso general</h3>
            <div className="gdocs-general-box">
              <div className="gdocs-general-left">
                <div className="gdocs-general-icon-wrap">
                  {generalAccess === 'RESTRICTED' ? (
                    <Lock size={18} />
                  ) : (
                    <Globe size={18} />
                  )}
                </div>
                <div className="gdocs-general-info">
                  <select
                    className="gdocs-general-select"
                    value={generalAccess}
                    onChange={(e) => setGeneralAccess(e.target.value as GeneralAccessType)}
                    aria-label="Acceso general"
                  >
                    <option value="RESTRICTED">Restringido</option>
                    <option value="ANYONE_WITH_LINK">
                      Cualquier persona con el enlace
                    </option>
                  </select>
                  <span className="gdocs-general-desc">
                    {generalAccess === 'RESTRICTED'
                      ? 'Solo los usuarios con acceso o invitación aceptada pueden abrir el enlace'
                      : 'Cualquier persona que tenga este enlace puede acceder'}
                  </span>
                </div>
              </div>

              {/* Selector de rol para acceso general */}
              {generalAccess === 'ANYONE_WITH_LINK' && (
                <select
                  className="gdocs-general-role-select"
                  value={generalAccessRole}
                  onChange={(e) =>
                    setGeneralAccessRole(e.target.value as Exclude<Role, 'OWNER'>)
                  }
                  aria-label="Rol para cualquier persona con el enlace"
                >
                  <option value="READER">Lector</option>
                  <option value="EDITOR">Editor</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Pie del Diálogo (Footer) */}
        <div className="gdocs-footer">
          <button
            className={`gdocs-copy-link-btn ${linkCopied ? 'copied' : ''}`}
            onClick={handleCopyLink}
            id="share-copy-link-btn"
          >
            {linkCopied ? <Check size={16} /> : <Link2 size={16} />}
            <span>{linkCopied ? 'Enlace copiado' : 'Copiar enlace'}</span>
          </button>

          <button
            className="gdocs-done-btn"
            onClick={closeShareDialog}
            id="share-done-btn"
          >
            Listo
          </button>
        </div>
      </div>
    </>
  );
}
