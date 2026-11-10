import { describe, expect, it, vi } from 'vitest';

import { isTokenExpired } from './client';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

const jwt = (payload: object) =>
  `h.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`;

describe('isTokenExpired', () => {
  const now = 1_700_000_000_000;
  it('detecta tokens vencidos o a punto de vencer (<20 s)', () => {
    expect(isTokenExpired(jwt({ exp: now / 1000 - 10 }), now)).toBe(true);
    expect(isTokenExpired(jwt({ exp: now / 1000 + 5 }), now)).toBe(true);
  });
  it('acepta tokens vigentes y sin exp', () => {
    expect(isTokenExpired(jwt({ exp: now / 1000 + 600 }), now)).toBe(false);
    expect(isTokenExpired(jwt({ sub: '1' }), now)).toBe(false);
  });
  it('trata un token mal formado como vencido', () => {
    expect(isTokenExpired('abc', now)).toBe(true);
    expect(isTokenExpired('a.b.c', now)).toBe(true);
  });
});
