import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollaborationPanel } from '../../src/components/CollaborationPanel';
import { useModelStore } from '../../src/store/model-store';

// Mock de los hooks de colaboración
vi.mock('../../src/hooks/use-collaboration', () => ({
  useCollaboration: vi.fn(),
}));

vi.mock('../../src/hooks/use-presence', () => ({
  usePresence: vi.fn(),
}));

vi.mock('../../src/collaboration/awareness', () => ({
  getOrCreateLocalIdentity: vi.fn(() => ({ name: 'Usuario Test', color: 'hsl(200, 70%, 55%)' })),
}));

import { useCollaboration } from '../../src/hooks/use-collaboration';
import { usePresence } from '../../src/hooks/use-presence';

const defaultCollab = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  setAwarenessState: vi.fn(),
  getVisualState: vi.fn(() => null),
  updateVisualStateNode: vi.fn(),
  removeVisualStateNode: vi.fn(),
  subscribeToVisualState: vi.fn(() => vi.fn()),
  status: 'idle' as const,
  roomName: null,
  peersCount: 0,
  peers: [],
  localClientId: 1,
  displayName: 'Usuario Test',
  error: null,
  roomNameWarning: null,
  clearWarning: vi.fn(),
};

const defaultPresence = { peers: [], peersCount: 0, localClientId: 1 };

describe('CollaborationPanel', () => {
  beforeEach(() => {
    vi.mocked(useCollaboration).mockReturnValue({ ...defaultCollab });
    vi.mocked(usePresence).mockReturnValue({ ...defaultPresence });
    useModelStore.getState().resetCollaboration();
  });

  it('estado idle: no renderiza el panel si no hay sesión activa', () => {
    const { container } = render(<CollaborationPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('estado disconnected: no renderiza el panel si la sesión está desconectada', () => {
    vi.mocked(useCollaboration).mockReturnValue({
      ...defaultCollab,
      status: 'disconnected',
    });
    const { container } = render(<CollaborationPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('estado synced: muestra botón "Desconectar"', () => {
    vi.mocked(useCollaboration).mockReturnValue({
      ...defaultCollab,
      status: 'synced',
      roomName: 'umlforge-test',
      peersCount: 2,
    });
    vi.mocked(usePresence).mockReturnValue({
      peers: [
        { clientId: 1, name: 'Usuario A', color: 'hsl(100, 70%, 55%)' },
        { clientId: 2, name: 'Usuario Test', color: 'hsl(200, 70%, 55%)' },
      ],
      peersCount: 2,
      localClientId: 1,
    });

    render(<CollaborationPanel />);
    expect(screen.getByRole('button', { name: /desconectar/i })).toBeInTheDocument();
  });

  it('estado synced: muestra lista de peers', () => {
    vi.mocked(useCollaboration).mockReturnValue({
      ...defaultCollab,
      status: 'synced',
      roomName: 'test',
      peersCount: 2,
    });
    vi.mocked(usePresence).mockReturnValue({
      peers: [
        { clientId: 1, name: 'Usuario A', color: 'hsl(100, 70%, 55%)' },
        { clientId: 2, name: 'Usuario B', color: 'hsl(200, 70%, 55%)' },
      ],
      peersCount: 2,
      localClientId: 1,
    });

    render(<CollaborationPanel />);
    expect(screen.getByTitle('Usuario A')).toBeInTheDocument();
    expect(screen.getByTitle('Usuario B')).toBeInTheDocument();
  });

  it('estado connecting: botón muestra "Conectando..." y está deshabilitado', () => {
    vi.mocked(useCollaboration).mockReturnValue({
      ...defaultCollab,
      status: 'connecting',
    });

    render(<CollaborationPanel />);
    const btn = screen.getByRole('button', { name: /conectando/i });
    expect(btn).toBeDisabled();
  });

  it('muestra roomNameWarning cuando está presente', () => {
    vi.mocked(useCollaboration).mockReturnValue({
      ...defaultCollab,
      status: 'synced',
      roomNameWarning: 'Tu modelo local ha sido reemplazado.',
    });

    render(<CollaborationPanel />);
    expect(screen.getByText(/tu modelo local ha sido reemplazado/i)).toBeInTheDocument();
  });

  it('NO muestra roomNameWarning cuando es null', () => {
    vi.mocked(useCollaboration).mockReturnValue({
      ...defaultCollab,
      status: 'synced',
      roomNameWarning: null,
    });

    render(<CollaborationPanel />);
    expect(screen.queryByText(/reemplazado/i)).not.toBeInTheDocument();
  });

  it('el botón de colapsar togglea el cuerpo del panel en sesión activa', () => {
    vi.mocked(useCollaboration).mockReturnValue({
      ...defaultCollab,
      status: 'synced',
      roomName: 'sala-activa',
    });
    render(<CollaborationPanel />);
    const toggleBtn = screen.getByRole('button', { name: /colapsar/i });
    expect(screen.getByText('sala-activa')).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    // Tras colapsar, el cuerpo con el nombre de la sala no debe estar en el DOM
    expect(screen.queryByText('sala-activa')).not.toBeInTheDocument();
  });

  it('llama a disconnect() al hacer click en Desconectar', () => {
    const mockDisconnect = vi.fn();
    vi.mocked(useCollaboration).mockReturnValue({
      ...defaultCollab,
      status: 'synced',
      disconnect: mockDisconnect,
    });
    vi.mocked(usePresence).mockReturnValue({ peers: [], peersCount: 0, localClientId: 1 });

    render(<CollaborationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /desconectar/i }));
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });
});
