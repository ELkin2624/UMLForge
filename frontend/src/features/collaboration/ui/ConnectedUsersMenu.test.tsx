import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectedUsersMenu } from './ConnectedUsersMenu';

vi.mock('../model/use-collaboration', () => ({
  useCollaboration: () => ({ status: 'synced' }),
}));
vi.mock('../model/use-presence', () => ({
  usePresence: () => ({
    peersCount: 2,
    localClientId: 1,
    peers: [
      { clientId: 1, name: 'Edixon', color: '#fde68a' },
      { clientId: 2, name: 'Miguel', color: '#bae6fd' },
      { clientId: 3, name: 'Arquitecto IA', color: '#e9d5ff', isAgent: true },
    ],
  }),
}));

describe('ConnectedUsersMenu', () => {
  it('muestra el número de personas y sus nombres sin contar al agente', () => {
    render(<ConnectedUsersMenu />);
    const trigger = screen.getByRole('button', { name: 'Personas conectadas: 2' });
    fireEvent.click(trigger);

    expect(screen.getByText('Edixon')).toBeInTheDocument();
    expect(screen.getByText('Miguel')).toBeInTheDocument();
    expect(screen.getByText('Arquitecto IA')).toBeInTheDocument();
    expect(screen.getByText('Tú')).toBeInTheDocument();
    expect(screen.getByText('Sincronizado en tiempo real')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desconectar' })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
