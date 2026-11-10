import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AgentPermissionControl } from './AgentPermissionControl';

describe('AgentPermissionControl', () => {
  it('permite a cualquier colaborador elegir su nivel personal', () => {
    const onChange = vi.fn();
    render(<AgentPermissionControl permission="ask" loading={false} loaded error={null} onChange={onChange} />);

    expect(screen.getByText('Solo tus solicitudes')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Nivel de acceso' }), { target: { value: 'safe' } });
    expect(onChange).toHaveBeenCalledWith('safe');
  });
});
