import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationsMenu } from './NotificationsMenu';

const { requestMock, switchMock, refreshMock, showEditorMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  switchMock: vi.fn(),
  refreshMock: vi.fn(),
  showEditorMock: vi.fn(),
}));

vi.mock('../../../api/client', () => ({ request: requestMock }));
vi.mock('../../diagram-manager', () => ({
  switchToDiagram: switchMock,
  useDiagramManagerStore: { getState: () => ({ refresh: refreshMock }) },
}));
vi.mock('../../projects-dashboard/model/dashboard-store', () => ({
  useDashboardStore: { getState: () => ({ showEditor: showEditorMock }) },
}));

const invitation = {
  id: 12,
  type: 'DIAGRAM_INVITATION',
  title: 'Invitación a diagrama',
  message: 'Edixon te invitó a UML Model.',
  read: true,
  data: { invitation_id: 7, invitation_status: 'PENDING' },
  created_at: '2026-11-10T10:00:00',
};

describe('NotificationsMenu', () => {
  beforeEach(() => {
    requestMock.mockImplementation((path: string) => {
      if (path === '/notifications/unread-count') return Promise.resolve({ count: 1 });
      if (path === '/notifications') return Promise.resolve([invitation]);
      if (path === '/invitations/7/accept') {
        return Promise.resolve({ success: true, diagram_id: 42, diagram_name: 'UML Model', role: 'EDITOR' });
      }
      return Promise.resolve({});
    });
    switchMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
  });

  afterEach(() => vi.clearAllMocks());

  it('permite aceptar una invitación leída y abre el diagrama compartido', async () => {
    render(<NotificationsMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    const accept = await screen.findByRole('button', { name: 'Aceptar' });
    fireEvent.click(accept);

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith('/invitations/7/accept', { method: 'POST' });
      expect(switchMock).toHaveBeenCalledWith(42);
      expect(refreshMock).toHaveBeenCalled();
      expect(showEditorMock).toHaveBeenCalled();
    });
  });
});
