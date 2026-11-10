import { describe, it, expect } from 'vitest';
import { shouldShowCollaborationPanel } from './panel-visibility';

describe('shouldShowCollaborationPanel', () => {
  it('se oculta cuando estás solo en la sala', () => {
    expect(shouldShowCollaborationPanel('synced', 1)).toBe(false);
    expect(shouldShowCollaborationPanel('connected', 0)).toBe(false);
  });

  it('aparece cuando entra otra persona', () => {
    expect(shouldShowCollaborationPanel('synced', 2)).toBe(true);
    expect(shouldShowCollaborationPanel('connected', 3)).toBe(true);
  });

  it('siempre aparece si hay un error de conexión', () => {
    expect(shouldShowCollaborationPanel('error', 1)).toBe(true);
  });

  it('no aparece sin sesión ni mientras conecta', () => {
    for (const s of ['idle', 'connecting', 'disconnected'] as const) {
      expect(shouldShowCollaborationPanel(s, 5)).toBe(false);
    }
  });
});
