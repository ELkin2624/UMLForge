import { describe, it, expect } from 'vitest';
import { dependencyKey, removeDecision, upsertDecision } from './decisions';

describe('decisions', () => {
  it('la clave no depende del orden de los atributos', () => {
    expect(dependencyKey('t', ['b', 'a'], ['c'])).toBe(dependencyKey('t', ['a', 'b'], ['c']));
    expect(dependencyKey('ventas', ['cliente_id'], ['x'])).toBe('ventas:cliente_id->x');
  });

  it('agrega y reemplaza la decisión sobre la misma dependencia', () => {
    const a = upsertDecision([], 't', ['a'], ['b'], 'accepted');
    expect(a).toHaveLength(1);
    const b = upsertDecision(a, 't', ['a'], ['b'], 'rejected');
    expect(b).toEqual([{ table: 't', lhs: ['a'], rhs: ['b'], status: 'rejected' }]);
    expect(a[0].status).toBe('accepted'); // inmutable
  });

  it('mantiene decisiones de otras dependencias y tablas', () => {
    let d = upsertDecision([], 't', ['a'], ['b'], 'accepted');
    d = upsertDecision(d, 't', ['a'], ['c'], 'custom');
    d = upsertDecision(d, 'u', ['a'], ['b'], 'rejected');
    expect(d).toHaveLength(3);
  });

  it('quita una decisión', () => {
    let d = upsertDecision([], 't', ['a'], ['b'], 'accepted');
    d = upsertDecision(d, 't', ['x'], ['y'], 'custom');
    d = removeDecision(d, 't', ['a'], ['b']);
    expect(d).toHaveLength(1);
    expect(d[0].lhs).toEqual(['x']);
  });
});
