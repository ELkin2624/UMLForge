import { describe, expect, it } from 'vitest';

import { relativeTime } from './format';

describe('relativeTime', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  it('trata fechas sin zona como UTC', () => {
    expect(relativeTime('2026-11-04T11:55:00', now)).toBe('hace 5 min');
  });
  it('formatea horas, días y momento', () => {
    expect(relativeTime('2026-11-04T09:00:00Z', now)).toBe('hace 3 h');
    expect(relativeTime('2026-11-02T12:00:00Z', now)).toBe('hace 2 d');
    expect(relativeTime('2026-11-04T11:59:50Z', now)).toBe('hace un momento');
  });
  it('devuelve vacío con una fecha inválida', () => {
    expect(relativeTime('nada', now)).toBe('');
  });
});
