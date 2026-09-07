import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { request } from '../../../api/client';
import './NotificationsMenu.css';

interface Notification {
  id: number;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function NotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const { count } = await request<{count: number}>('/notifications/unread-count');
      setUnreadCount(count);
      if (isOpen) {
        const data = await request<Notification[]>('/notifications');
        setNotifications(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [isOpen]);

  const markAsRead = async (id: number) => {
    try {
      await request(`/notifications/${id}/read`, { method: 'PUT' });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await request(`/notifications/read-all`, { method: 'PUT' });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="notifications-container">
      <button className="notifications-btn" onClick={() => setIsOpen(!isOpen)}>
        <Bell size={20} />
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h4>Notificaciones</h4>
            <button onClick={markAllAsRead}>Marcar leídas</button>
          </div>
          <div className="notifications-list">
            {notifications.length === 0 && <p className="empty">No hay notificaciones.</p>}
            {notifications.map(n => (
              <div key={n.id} className={`notification-item ${n.read ? 'read' : 'unread'}`} onClick={() => !n.read && markAsRead(n.id)}>
                <h5>{n.title}</h5>
                <p>{n.message}</p>
                <small>{new Date(n.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
