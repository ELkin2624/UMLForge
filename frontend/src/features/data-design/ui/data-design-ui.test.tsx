import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NormalizationTab } from './NormalizationTab';
import { layoutTables } from './DbDiagramTab';
import { useDataDesignStore } from '../model/data-design-store';
import type { DataDesignResult } from '../api/data-design-api';

const result: DataDesignResult = {
  logical: {
    tables: [
      {
        name: 'clientes', class_name: 'Cliente', kind: 'entity', primary_key: ['id'],
        columns: [{ name: 'id', sql_type: 'BIGINT', is_pk: true, is_fk: false, nullable: false, references: null }],
        foreign_keys: [], notes: [],
      },
      {
        name: 'ventas', class_name: 'Venta', kind: 'entity', primary_key: ['id'],
        columns: [
          { name: 'id', sql_type: 'BIGINT', is_pk: true, is_fk: false, nullable: false, references: null },
          { name: 'cliente_id', sql_type: 'BIGINT', is_pk: false, is_fk: true, nullable: true, references: 'clientes.id' },
        ],
        foreign_keys: [{ columns: ['cliente_id'], ref_table: 'clientes', ref_columns: ['id'], on_delete: null }],
        notes: [],
      },
    ],
    edges: [{ id: 'e1', from_table: 'ventas', to_table: 'clientes', columns: ['cliente_id'], cardinality: 'N:1', label: 'cliente_id' }],
    mappings: [],
  },
  normalization: [
    {
      table: 'ventas', attributes: ['id', 'cliente_id', 'clienteNombre'], primary_key: ['id'],
      dependencies: [
        { id: 'ventas:id->cliente_id,clienteNombre', lhs: ['id'], rhs: ['cliente_id', 'clienteNombre'], source: 'key', status: 'confirmed', reason: 'La clave primaria determina todo.', rule: null, confidence: 'high' },
        { id: 'ventas:cliente_id->clienteNombre', lhs: ['cliente_id'], rhs: ['clienteNombre'], source: 'inferred', status: 'suggested', reason: 'Parece un atributo de Cliente.', rule: 'transitive_entity', confidence: 'high' },
      ],
      candidate_keys: [['id']], keys_exact: true, prime_attributes: ['id'],
      checks: [
        { form: '1FN', ok: true, detail: 'Atómicos.', evidence: [] },
        { form: '2FN', ok: true, detail: 'Clave simple.', evidence: [] },
        { form: '3FN', ok: true, detail: 'Cumple.', evidence: [] },
        { form: 'FNBC', ok: true, detail: 'Cumple.', evidence: [] },
      ],
      normal_form: 'FNBC', normal_form_if_suggestions_accepted: '2FN', pending_suggestions: 1,
      proof: ['{id}⁺ = {id, cliente_id, clienteNombre} → clave candidata'],
      decomposition: null, warnings: [],
    },
  ],
  summary: { tables: 2, by_form: { FNBC: 1 }, all_in_3nf: true, pending_suggestions: 1 },
};

describe('layoutTables', () => {
  it('crea un nodo por tabla y una arista por clave foránea', () => {
    const { nodes, edges } = layoutTables(result);
    expect(nodes.map((n) => n.id).sort()).toEqual(['clientes', 'ventas']);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('ventas');
    expect(edges[0].target).toBe('clientes');
    expect(String(edges[0].label)).toContain('N:1');
    nodes.forEach((n) => {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    });
  });
});

describe('NormalizationTab', () => {
  const decide = vi.fn().mockResolvedValue(undefined);
  const undecide = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    decide.mockClear();
    undecide.mockClear();
    useDataDesignStore.setState({ selectedTable: 'ventas', decide, undecide });
  });

  it('avisa de sugerencias pendientes y de la forma normal resultante', () => {
    render(<NormalizationTab result={result} />);
    expect(screen.getAllByText(/1 sugerencia sin revisar/).length).toBeGreaterThan(0);
    expect(screen.getByText(/si las aceptas/)).toBeInTheDocument();
  });

  it('aceptar una sugerencia registra la decisión', () => {
    render(<NormalizationTab result={result} />);
    fireEvent.click(screen.getByRole('button', { name: /Aceptar/ }));
    expect(decide).toHaveBeenCalledWith('ventas', ['cliente_id'], ['clienteNombre'], 'accepted');
  });

  it('rechazar una sugerencia registra la decisión', () => {
    render(<NormalizationTab result={result} />);
    fireEvent.click(screen.getByRole('button', { name: /Rechazar/ }));
    expect(decide).toHaveBeenCalledWith('ventas', ['cliente_id'], ['clienteNombre'], 'rejected');
  });

  it('la dependencia de clave no se puede aceptar ni rechazar', () => {
    render(<NormalizationTab result={result} />);
    expect(screen.getAllByRole('button', { name: /Aceptar/ })).toHaveLength(1);
  });

  it('declarar una dependencia manual la envía como custom', async () => {
    render(<NormalizationTab result={result} />);
    fireEvent.click(screen.getByText(/Declarar una dependencia funcional/));
    const lhs = screen.getByRole('group', { name: /Determinante/ });
    const rhs = screen.getByRole('group', { name: /Determinados/ });
    fireEvent.click(lhs.querySelector('button[aria-pressed]') as HTMLElement); // 1.º atributo: id
    fireEvent.click(Array.from(rhs.querySelectorAll('button')).find((b) => b.textContent === 'clienteNombre') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /^Agregar/ }));
    expect(decide).toHaveBeenCalledWith('ventas', ['id'], ['clienteNombre'], 'custom');
  });
});
