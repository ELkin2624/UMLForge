import { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Users, CheckCircle2, ExternalLink } from 'lucide-react';
import { request } from '../../../api/client';
import { useShareStore } from '../../sharing/model/share-store';
import { useModelStore } from '../../../store/model-store';
import { useCollaboration } from '../../../hooks/use-collaboration';
import { buildInvitationDeepLink } from '../../sharing/model/invite-utils';
import './NotificationsMenu.css';

interface NotificationData {
  diagram_id?: number;
  diagram_name?: string;
  invitation_id?: number;
  inviter_id?: number;
  inviter_name?: string;
  role?: string;
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: NotificationData | null;
  created_at: string;
}

export function NotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: number; message: string; success: boolean } | null>(null);

  const { joinSession } = useShareStore();
  const { setModel } = useModelStore();
  const { connect } = useCollaboration();

  // Ref para el polling del badge de no-leídas
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = async () => {
    try {
      const { count } = await request<{ count: number }>('/notifications/unread-count');
      setUnreadCount(count);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFullList = async () => {
    try {
      const data = await request<Notification[]>('/notifications');
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Polling ligero cada 30s para el badge de no-leídas
  useEffect(() => {
    fetchNotifications();
    pollIntervalRef.current = setInterval(fetchNotifications, 30_000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Lista completa sólo cuando se abre el panel
  useEffect(() => {
    if (isOpen) {
      fetchFullList();
    }
  }, [isOpen]);

  const markAsRead = async (id: number) => {
    try {
      await request(`/notifications/${id}/read`, { method: 'PUT' });
      fetchNotifications();
      fetchFullList();
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await request(`/notifications/read-all`, { method: 'PUT' });
      fetchNotifications();
      fetchFullList();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptInvitation = async (notification: Notification) => {
    if (!notification.data?.invitation_id) return;
    const invId = notification.data.invitation_id;
    setActionLoadingId(notification.id);
    setActionFeedback(null);

    try {
      const res = await request<{ success: boolean; diagram_id: number; diagram_name: string; role: string }>(
        `/invitations/${invId}/accept`,
        { method: 'POST' }
      );

      setActionFeedback({
        id: notification.id,
        message: `¡Invitación aceptada como ${res.role === 'EDITOR' ? 'Editor' : 'Lector'}! Abriendo "${res.diagram_name}"…`,
        success: true,
      });

      const roomStr = res.diagram_id.toString();
      try {
        sessionStorage.setItem('umlforge-active-diagram', roomStr);
        sessionStorage.setItem('umlforge-collab-active', 'true');
        const url = new URL(window.location.href);
        url.searchParams.set('diagram', roomStr);
        window.history.replaceState({}, '', url.toString());
      } catch {}

      // Cargar diagrama compartido en el lienzo
      try {
        const diagramData = await request<any>(`/diagrams/${res.diagram_id}`);
        if (diagramData) {
          joinSession(roomStr, res.role as any);
          connect(roomStr);
          if (diagramData.data && (diagramData.data.classes?.length || diagramData.data.components?.length)) {
            setModel(diagramData.data);
          }
        }
      } catch (err) {
        console.warn('Diagrama aceptado pero no se pudo cargar automáticamente:', err);
      }

      fetchNotifications();
      fetchFullList();
      // Cerrar panel para que el usuario vea el lienzo
      setTimeout(() => setIsOpen(false), 1200);
    } catch (err: any) {
      setActionFeedback({
        id: notification.id,
        message: err.message || 'La invitación ya fue respondida o no es válida.',
        success: false,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectInvitation = async (notification: Notification) => {
    if (!notification.data?.invitation_id) return;
    const invId = notification.data.invitation_id;
    setActionLoadingId(notification.id);
    setActionFeedback(null);

    try {
      await request(`/invitations/${invId}/reject`, { method: 'POST' });
      setActionFeedback({
        id: notification.id,
        message: 'Invitación rechazada.',
        success: true,
      });
      fetchNotifications();
      fetchFullList();
    } catch (err: any) {
      setActionFeedback({
        id: notification.id,
        message: err.message || 'Error al rechazar invitación.',
        success: false,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  /**
   * Abre la invitación como deep-link en la misma pestaña.
   * Si el usuario recarga la página, el sistema la manejará automáticamente.
   */
  const handleOpenInviteLink = (notification: Notification) => {
    const invId = notification.data?.invitation_id;
    if (!invId) return;
    const url = buildInvitationDeepLink(invId);
    // Navegar a la URL en la misma pestaña (la app la maneja al cargar)
    window.location.href = url;
  };

  return (
    <div className="notifications-container">
      <button
        className="notifications-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificaciones"
        title="Notificaciones"
        id="notifications-bell-btn"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h4>Notificaciones</h4>
            {notifications.some((n) => !n.read) && (
              <button onClick={markAllAsRead}>Marcar leídas</button>
            )}
          </div>

          <div className="notifications-list">
            {notifications.length === 0 && (
              <p className="empty">No tienes notificaciones pendientes.</p>
            )}

            {notifications.map((n) => {
              const isInvitation = n.type === 'DIAGRAM_INVITATION' && n.data?.invitation_id;
              const feedbackForThis = actionFeedback?.id === n.id ? actionFeedback : null;
              const isAlreadyRead = n.read;

              return (
                <div
                  key={n.id}
                  className={`notification-item ${isAlreadyRead ? 'read' : 'unread'}`}
                  onClick={() => !isAlreadyRead && !isInvitation && markAsRead(n.id)}
                >
                  <div className="notification-title-row">
                    {isInvitation && <Users size={15} className="notif-type-icon" />}
                    <h5>{n.title}</h5>
                  </div>
                  <p>{n.message}</p>
                  <small>{new Date(n.created_at).toLocaleString()}</small>

                  {/* Acciones interactivas para invitaciones pendientes */}
                  {isInvitation && !isAlreadyRead && (
                    <div className="notification-actions-row">
                      <button
                        className="notif-btn-accept"
                        disabled={actionLoadingId === n.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptInvitation(n);
                        }}
                      >
                        <Check size={14} /> Aceptar
                      </button>
                      <button
                        className="notif-btn-reject"
                        disabled={actionLoadingId === n.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRejectInvitation(n);
                        }}
                      >
                        <X size={14} /> Rechazar
                      </button>
                      {/* Deep-link: botón para abrir la invitación como URL persistente */}
                      <button
                        className="notif-btn-link"
                        title="Abrir enlace de invitación (persistente tras recarga)"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInviteLink(n);
                        }}
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  )}

                  {feedbackForThis && (
                    <div
                      className={`notif-feedback-pill ${feedbackForThis.success ? 'success' : 'error'}`}
                    >
                      {feedbackForThis.success ? <CheckCircle2 size={13} /> : null}
                      <span>{feedbackForThis.message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
