import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildTableScene, buildTablesScene } from '@/features/analysis/tables-scene';
import type { LogicalModel } from '@/features/analysis/data-design-api';
import type { UMLModel } from '@/types/canonical-model';

import { drawScene } from './draw';
import { buildScene } from './scene';
import { sceneToSvgString } from './to-svg-string';

const classModel: UMLModel = {
  classes: [
    {
      id: 'animal', name: 'Animal', is_abstract: true,
      attributes: [
        { id: 'a1', name: 'nombre', type: 'String', visibility: 'private' },
        { id: 'a2', name: 'total', type: 'int', visibility: 'public', is_static: true },
      ],
      operations: [
        { id: 'o1', name: 'comer', return_type: 'void', visibility: 'public', is_abstract: true },
        { id: 'o2', name: 'dormir', return_type: 'boolean', parameters: [{ id: 'p', name: 'horas', type: 'int' }] },
      ],
    },
    { id: 'perro', name: 'Perro', attributes: [{ id: 'a3', name: 'raza', type: 'String' }], operations: [] },
    { id: 'dueno', name: 'Dueño', attributes: [{ id: 'a4', name: 'telefonos', type: 'String', multiplicity: '1..3' }], operations: [] },
    { id: 'casa', name: 'Casa', attributes: [], operations: [] },
    { id: 'cuarto', name: 'Cuarto', attributes: [], operations: [] },
    { id: 'club', name: 'Club', attributes: [], operations: [] },
    { id: 'serv', name: 'Servicio', attributes: [], operations: [] },
    { id: 'adop', name: 'Adopcion', attributes: [{ id: 'a5', name: 'fecha', type: 'Date' }], operations: [], is_association_class: true, association_source_id: 'perro', association_target_id: 'dueno' } as never,
  ],
  relationships: [
    { id: 'r1', source_id: 'perro', target_id: 'animal', type: 'generalization' },
    { id: 'r2', source_id: 'perro', target_id: 'dueno', type: 'association', source_multiplicity: '0..*', target_multiplicity: '1' },
    { id: 'r3', source_id: 'cuarto', target_id: 'casa', type: 'composition', source_multiplicity: '1..*', target_multiplicity: '1' },
    { id: 'r4', source_id: 'dueno', target_id: 'club', type: 'aggregation', source_multiplicity: '*', target_multiplicity: '0..1' },
    { id: 'r5', source_id: 'dueno', target_id: 'serv', type: 'dependency' },
    { id: 'r6', source_id: 'perro', target_id: 'serv', type: 'realization' },
  ],
  components: [], interfaces: [], diagrams: [],
};

const componentModel: UMLModel = {
  classes: [], relationships: [], diagrams: [],
  components: [{ id: 'web', name: 'WebApp' }, { id: 'api', name: 'PedidosAPI' }, { id: 'db', name: 'Repositorio' }],
  interfaces: [
    { id: 'ipedidos', name: 'IPedidos', operations: [{ id: 'o', name: 'crear', return_type: 'Pedido' }] },
    { id: 'irepo', name: 'IRepo', operations: [] },
  ],
  dependencies: [
    { id: 'd1', source_id: 'web', target_id: 'ipedidos', type: 'dependency' },
    { id: 'd2', source_id: 'api', target_id: 'ipedidos', type: 'realization' },
    { id: 'd3', source_id: 'api', target_id: 'irepo', type: 'dependency' },
    { id: 'd4', source_id: 'db', target_id: 'irepo', type: 'realization' },
  ],
};

const assemblyModel: UMLModel = {
  classes: [], relationships: [], diagrams: [],
  components: [{ id: 'a', name: 'Cliente' }, { id: 'b', name: 'Servidor' }],
  interfaces: [{ id: 'i', name: 'IDatos', operations: [] }],
  ports: [
    { id: 'pa', name: 'req', component_id: 'a', interface_id: 'i', kind: 'required' },
    { id: 'pb', name: 'prov', component_id: 'b', interface_id: 'i', kind: 'provided' },
  ],
  connectors: [{ id: 'k', source_port_id: 'pa', target_port_id: 'pb' }],
};

const logical: LogicalModel = {
  tables: [
    { name: 'cliente', class_name: 'Cliente', kind: 'entity', columns: [
      { name: 'id', sql_type: 'BIGINT', is_pk: true, is_fk: false, nullable: false, references: null },
      { name: 'nombre', sql_type: 'VARCHAR(255)', is_pk: false, is_fk: false, nullable: false, references: null },
    ], primary_key: ['id'], foreign_keys: [], notes: [] },
    { name: 'pedido', class_name: 'Pedido', kind: 'entity', columns: [
      { name: 'id', sql_type: 'BIGINT', is_pk: true, is_fk: false, nullable: false, references: null },
      { name: 'cliente_id', sql_type: 'BIGINT', is_pk: false, is_fk: true, nullable: false, references: 'cliente.id' },
    ], primary_key: ['id'], foreign_keys: [], notes: [] },
  ],
  edges: [{ id: 'e1', from_table: 'pedido', to_table: 'cliente', columns: ['cliente_id'], cardinality: 'N:1', label: null }],
  mappings: [],
};

describe('drawScene', () => {
  it('produce primitivas para clases, componentes y BD sin lanzar', () => {
    for (const scene of [buildScene(classModel), buildScene(componentModel), buildScene(assemblyModel), buildTablesScene(logical)]) {
      expect(drawScene(scene).length).toBeGreaterThan(0);
    }
  });

  it('una tabla suelta se dibuja como caja «Table» ajustada, sin márgenes grandes', () => {
    const scene = buildTableScene(logical.tables[1]);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.width - scene.nodes[0].width).toBeLessThan(20);
    expect(drawScene(scene).some((o) => o.t === 'text' && o.text === '«Table»')).toBe(true);
  });

  it('la dependencia termina en una polilínea abierta y la generalización en un polígono cerrado', () => {
    const ops = drawScene(buildScene(classModel));
    const polys = ops.filter((o) => o.t === 'poly');
    expect(polys.some((o) => o.t === 'poly' && !o.closed && o.dash === undefined && o.points.length === 3)).toBe(true); // V
    expect(polys.some((o) => o.t === 'poly' && o.closed && o.fill === '#ffffff')).toBe(true); // triángulo/rombo hueco
    expect(polys.some((o) => o.t === 'poly' && o.closed && o.fill === '#1a1a1a')).toBe(true); // rombo relleno
  });

  it('nombre de clase abstracta en cursiva y miembro estático subrayado', () => {
    const ops = drawScene(buildScene(classModel));
    expect(ops.some((o) => o.t === 'text' && o.text === 'Animal' && o.italic && o.bold)).toBe(true);
    expect(ops.some((o) => o.t === 'text' && o.text.includes('total') && o.underline)).toBe(true);
  });

  // Opcional: UML_PREVIEW_DIR=/ruta npx vitest run draw  → escribe SVG para revisar con ImageMagick.
  it('escribe vistas previas SVG si se pide', () => {
    const dir = process.env.UML_PREVIEW_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'clases.svg'), sceneToSvgString(buildScene(classModel)));
    writeFileSync(join(dir, 'componentes.svg'), sceneToSvgString(buildScene(componentModel)));
    writeFileSync(join(dir, 'ensamble.svg'), sceneToSvgString(buildScene(assemblyModel)));
    writeFileSync(join(dir, 'bd.svg'), sceneToSvgString(buildTablesScene(logical)));
    writeFileSync(join(dir, 'tabla.svg'), sceneToSvgString(buildTableScene(logical.tables[1])));
  });
});
