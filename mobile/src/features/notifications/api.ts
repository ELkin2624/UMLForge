import { request } from '@/shared/api/client';
import type { AppNotification } from '@/types/api';

export const listNotifications = () => request<AppNotification[]>('/notifications');
export const unreadCount = () => request<{ count: number }>('/notifications/unread-count');
export const markRead = (id: number) =>
  request<AppNotification>(`/notifications/${id}/read`, { method: 'PUT' });
export const markAllRead = () => request('/notifications/read-all', { method: 'PUT' });
export const acceptInvitation = (id: number) =>
  request<{ diagram_id: number; diagram_name: string; role: string }>(`/invitations/${id}/accept`, {
    method: 'POST',
  });
export const rejectInvitation = (id: number) =>
  request(`/invitations/${id}/reject`, { method: 'POST' });
