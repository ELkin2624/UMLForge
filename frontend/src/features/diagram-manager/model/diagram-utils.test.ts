import { describe, it, expect } from 'vitest';
import type { DiagramSummary } from '../../../api/diagrams-api';
import { emptyModel, filterDiagrams, hasContent, toRole } from './diagram-utils';

const d = (id: number, name: string, owner: number, updated: string): DiagramSummary => ({
  id, name, owner_id: owner, created_at: updated, updated_at: updated, my_role: 'OWNER',
});

describe('diagram-utils', () => {
  it('toRole trata lo desconocido como lector', () => {
    expect(toRole('OWNER')).toBe('OWNER');
    expect(toRole('EDITOR')).toBe('EDITOR');
    expect(toRole(null)).toBe('READER');
    expect(toRole('x')).toBe('READER');
  });

  it('hasContent exige clases o componentes', () => {
    expect(hasContent({})).toBe(false);
    expect(hasContent(null)).toBe(false);
    expect(hasContent(emptyModel('A'))).toBe(false);
    expect(hasContent({ ...emptyModel('A'), classes: [{ id: '1' } as never] })).toBe(true);
  });

  it('emptyModel genera ids distintos', () => {
    expect(emptyModel('A').id).not.toBe(emptyModel('A').id);
  });

  it('filterDiagrams filtra por texto y propiedad, y ordena por fecha', () => {
    const list = [
      d(1, 'Banco', 1, '2026-01-01T00:00:00'),
      d(2, 'Barbería', 2, '2026-03-01T00:00:00'),
      d(3, 'Tienda', 1, '2026-02-01T00:00:00'),
    ];
    expect(filterDiagrams(list, '', 'all', 1).map((x) => x.id)).toEqual([2, 3, 1]);
    expect(filterDiagrams(list, 'ban', 'all', 1).map((x) => x.id)).toEqual([1]);
    expect(filterDiagrams(list, '', 'own', 1).map((x) => x.id)).toEqual([3, 1]);
    expect(filterDiagrams(list, '', 'shared', 1).map((x) => x.id)).toEqual([2]);
  });
});
