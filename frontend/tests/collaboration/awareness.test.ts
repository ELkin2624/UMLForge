import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOrCreateLocalIdentity } from '../../src/collaboration/awareness';

// Implementación manual de sessionStorage para tests
const createSessionStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
};

describe('awareness - getOrCreateLocalIdentity', () => {
  let storageMock: ReturnType<typeof createSessionStorageMock>;

  beforeEach(() => {
    storageMock = createSessionStorageMock();
    vi.stubGlobal('sessionStorage', storageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('genera una identidad con nombre y color cuando sessionStorage está vacío', () => {
    const identity = getOrCreateLocalIdentity();
    expect(identity.name).toBeTruthy();
    expect(identity.color).toMatch(/^hsl\(/);
  });

  it('retorna la misma identidad en llamadas repetidas (estable dentro de sesión)', () => {
    const first = getOrCreateLocalIdentity();
    const second = getOrCreateLocalIdentity();
    expect(first.name).toBe(second.name);
    expect(first.color).toBe(second.color);
  });

  it('persiste la identidad en sessionStorage', () => {
    const identity = getOrCreateLocalIdentity();
    const stored = JSON.parse(storageMock.getItem('umlforge-identity') ?? '{}');
    expect(stored.name).toBe(identity.name);
    expect(stored.color).toBe(identity.color);
  });

  it('recupera identidad existente de sessionStorage sin regenerar', () => {
    const existing = { name: 'Arquitecto Fijo 123', color: 'hsl(240, 70%, 55%)' };
    storageMock.setItem('umlforge-identity', JSON.stringify(existing));
    const identity = getOrCreateLocalIdentity();
    expect(identity.name).toBe(existing.name);
    expect(identity.color).toBe(existing.color);
  });

  it('genera nueva identidad si el JSON en sessionStorage está corrupto', () => {
    storageMock.setItem('umlforge-identity', 'NOT_JSON');
    // No debe lanzar error
    expect(() => getOrCreateLocalIdentity()).not.toThrow();
  });

  it('genera nueva identidad si el objeto guardado está incompleto', () => {
    storageMock.setItem('umlforge-identity', JSON.stringify({ name: '' }));
    const identity = getOrCreateLocalIdentity();
    // Debe generar nombre válido aunque el anterior estuviera vacío
    expect(identity.name.length).toBeGreaterThan(0);
  });
});
