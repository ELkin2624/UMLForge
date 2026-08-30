import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Notification } from '../../src/components/Notification';

describe('Notification', () => {
  it('debería renderizar el mensaje correctamente', () => {
    render(<Notification type="info" message="Mensaje de prueba" />);

    expect(screen.getByText('Mensaje de prueba')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('debería renderizar tipo success y error', () => {
    const { rerender } = render(<Notification type="success" message="Operación exitosa" />);
    expect(screen.getByText('Operación exitosa')).toBeInTheDocument();

    rerender(<Notification type="error" message="Ocurrió un error grave" />);
    expect(screen.getByText('Ocurrió un error grave')).toBeInTheDocument();
  });

  it('debería invocar onClose al hacer clic en el botón de cerrar', () => {
    const onClose = vi.fn();
    render(<Notification type="error" message="Error de red" onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: /Cerrar notificación/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
