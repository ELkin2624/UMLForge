import { describe, expect, it } from 'vitest';

import type { LogicalModel } from './data-design-api';
import { buildTablesScene } from './tables-scene';

const col = (name: string, is_pk = false, is_fk = false) => ({
  name, sql_type: 'BIGINT', is_pk, is_fk, nullable: !is_pk, references: null,
});

describe('buildTablesScene', () => {
  it('crea una caja por tabla y una arista por clave foránea válida', () => {
    const logical: LogicalModel = {
      tables: [
        { name: 'cliente', class_name: 'Cliente', kind: 'entity', columns: [col('id', true)], primary_key: ['id'], foreign_keys: [], notes: [] },
        { name: 'pedido', class_name: 'Pedido', kind: 'entity', columns: [col('id', true), col('cliente_id', false, true)], primary_key: ['id'], foreign_keys: [], notes: [] },
      ],
      edges: [
        { id: 'e1', from_table: 'pedido', to_table: 'cliente', columns: ['cliente_id'], cardinality: 'N:1', label: null },
        { id: 'e2', from_table: 'pedido', to_table: 'fantasma', columns: [], cardinality: 'N:1', label: null },
      ],
      mappings: [],
    };
    const scene = buildTablesScene(logical);
    expect(scene.nodes.map((n) => n.id).sort()).toEqual(['cliente', 'pedido']);
    expect(scene.edges.map((e) => e.id)).toEqual(['e1']);
    expect(scene.nodes.find((n) => n.id === 'pedido')?.attributes[1].text).toBe('«FK» cliente_id : BIGINT');
    expect(scene.nodes.find((n) => n.id === 'pedido')?.stereotype).toBe('Table');
    expect(scene.edges[0].labels.map((l) => l.text)).toEqual(expect.arrayContaining(['0..*', '1', 'cliente_id']));
  });
});
