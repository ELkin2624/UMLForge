import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAgentPresence } from './use-agent-presence';

const { getSettings, setSettings } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  setSettings: vi.fn(),
}));

vi.mock('../api/agent-presence-api', () => ({
  getAgentEnabled: getSettings,
  setAgentEnabled: setSettings,
}));

describe('useAgentPresence', () => {
  it('permite cambiar el permiso personal sin habilitar la presencia común', async () => {
    getSettings.mockResolvedValue({ enabled: true, permission: 'safe' });
    setSettings.mockResolvedValue({ enabled: true, permission: 'full' });
    const { result } = renderHook(() => useAgentPresence('5', true, false));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.permission).toBe('safe');
    expect(getSettings).toHaveBeenCalledWith('5');

    await act(async () => { await result.current.update('full'); });
    expect(setSettings).toHaveBeenCalledWith('5', { permission: 'full' });
    expect(result.current.permission).toBe('full');

    setSettings.mockClear();
    await act(async () => { await result.current.update(false); });
    expect(setSettings).not.toHaveBeenCalled();
  });
});
