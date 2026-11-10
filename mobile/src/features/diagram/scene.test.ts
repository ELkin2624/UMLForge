import { describe, expect, it } from 'vitest';

import type { UMLModel } from '@/types/canonical-model';

import { buildScene, edgeMarkers, endLabelPos, formatAttribute, formatOperation, normalizeEdgeKind } from './scene';

const model = (over: Partial<UMLModel>): UMLModel => ({
  classes: [],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
  ...over,
});

const cls = (id: string, name: string, extra: object = {}) => ({ id, name, attributes: [], operations: [], ...extra });

describe('buildScene', () => {
  it('devuelve escena vacía con tamaño mínimo para un modelo nulo', () => {
    const s = buildScene(null);
    expect(s.nodes).toHaveLength(0);
    expect(s.width).toBeGreaterThanOrEqual(200);
  });

  it('coloca el padre de una generalización encima del hijo y sin solapes', () => {
    const s = buildScene(
      model({
        classes: [cls('a', 'Animal'), cls('b', 'Perro'), cls('c', 'Gato')],
        relationships: [
          { id: 'r1', source_id: 'b', target_id: 'a', type: 'generalization' },
          { id: 'r2', source_id: 'c', target_id: 'a', type: 'Generalization' },
        ],
      })
    );
    const by = Object.fromEntries(s.nodes.map((n) => [n.id, n]));
    expect(by.a.y + by.a.height).toBeLessThan(by.b.y);
    for (const x of s.nodes)
      for (const y of s.nodes) {
        if (x.id >= y.id) continue;
        const overlap = x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height;
        expect(overlap).toBe(false);
      }
  });

  it('descarta relaciones con extremos inexistentes y tolera source/target legacy', () => {
    const s = buildScene(
      model({
        classes: [cls('a', 'A'), cls('b', 'B')],
        relationships: [
          { id: 'ok', source: 'a', target: 'b', type: 'association' } as never,
          { id: 'bad', source_id: 'a', target_id: 'zzz', type: 'association' },
        ],
      })
    );
    expect(s.edges.map((e) => e.id)).toEqual(['ok']);
  });

  it('soporta autorelaciones y ciclos', () => {
    const s = buildScene(
      model({
        classes: [cls('a', 'A'), cls('b', 'B')],
        relationships: [
          { id: 'self', source_id: 'a', target_id: 'a', type: 'association', source_multiplicity: '1', target_multiplicity: '0..*' },
          { id: 'x', source_id: 'a', target_id: 'b', type: 'association' },
          { id: 'y', source_id: 'b', target_id: 'a', type: 'association' },
        ],
      })
    );
    expect(s.edges).toHaveLength(3);
    expect(s.edges.every((e) => e.points.length >= 2)).toBe(true);
    expect(s.edges.find((e) => e.id === 'self')?.labels).toHaveLength(2);
  });

  it('una clase siempre tiene compartimento de operaciones, incluso vacío', () => {
    const [n] = buildScene(model({ classes: [cls('a', 'A')] })).nodes;
    expect(n.showOperations).toBe(true);
    expect(n.height).toBeGreaterThan(34 + 14); // nombre + atributos vacíos + operaciones vacías
  });

  it('une una clase de asociación al punto medio de su asociación', () => {
    const s = buildScene(
      model({
        classes: [
          cls('p', 'Persona'),
          cls('e', 'Empresa'),
          cls('c', 'Contrato', { is_association_class: true, association_source_id: 'p', association_target_id: 'e' }),
        ],
        relationships: [{ id: 'trabaja', source_id: 'p', target_id: 'e', type: 'association' }],
      })
    );
    const link = s.edges.find((e) => e.kind === 'assoc-class');
    const assoc = s.edges.find((e) => e.id === 'trabaja')!;
    expect(link).toBeDefined();
    const mid = link!.points[1];
    const xs = assoc.points.map((p) => p.x);
    const ys = assoc.points.map((p) => p.y);
    expect(mid.x).toBeGreaterThanOrEqual(Math.min(...xs) - 1);
    expect(mid.x).toBeLessThanOrEqual(Math.max(...xs) + 1);
    expect(mid.y).toBeGreaterThanOrEqual(Math.min(...ys) - 1);
    expect(mid.y).toBeLessThanOrEqual(Math.max(...ys) + 1);
  });

  it('dibuja componentes con interfaces como círculos y dependencias', () => {
    const s = buildScene(
      model({
        components: [{ id: 'c1', name: 'Web' }, { id: 'c2', name: 'Api' }],
        interfaces: [{ id: 'i1', name: 'IUsers', operations: [] }],
        dependencies: [
          { id: 'd1', source_id: 'c1', target_id: 'i1', type: 'dependency' },
          { id: 'd2', source_id: 'c2', target_id: 'i1', type: 'realization' },
        ],
      })
    );
    expect(s.nodes.map((n) => n.kind).sort()).toEqual(['component', 'component', 'iface']);
    expect(s.edges.find((e) => e.id === 'd1')?.kind).toBe('dependency');
    expect(s.edges.find((e) => e.id === 'd2')?.kind).toBe('provided');
  });

  it('une puertos provista/requerida de la misma interfaz como bola-y-socket', () => {
    const s = buildScene(
      model({
        components: [{ id: 'c1', name: 'Web' }, { id: 'c2', name: 'Api' }],
        interfaces: [{ id: 'i1', name: 'IUsers', operations: [] }],
        ports: [
          { id: 'p1', name: 'out', component_id: 'c1', interface_id: 'i1', kind: 'required' },
          { id: 'p2', name: 'in', component_id: 'c2', interface_id: 'i1', kind: 'provided' },
        ],
        connectors: [{ id: 'k', source_port_id: 'p1', target_port_id: 'p2' }],
      })
    );
    const asm = s.edges.find((e) => e.kind === 'assembly');
    expect(asm).toBeDefined();
    expect(asm!.providerAtStart).toBe(false); // el origen (p1) es el requerido
    expect(asm!.labels[0].text).toBe('IUsers');
    expect(s.nodes.some((n) => n.kind === 'iface')).toBe(false); // la interfaz ya está en el ensamble
    expect(s.nodes.find((n) => n.id === 'c1')?.ports).toHaveLength(1);
  });
});

describe('formato UML 2.5', () => {
  it('normaliza tipos de relación', () => {
    expect(normalizeEdgeKind('Inheritance')).toBe('generalization');
    expect(normalizeEdgeKind('COMPOSITION')).toBe('composition');
    expect(normalizeEdgeKind(undefined)).toBe('association');
  });

  it('atributo: visibilidad, tipo, multiplicidad, valor inicial, estático e id', () => {
    expect(formatAttribute({ id: '1', name: 'n', type: 'int' }).text).toBe('- n : int');
    const full = formatAttribute({
      id: '1', name: 'tags', type: 'String', visibility: 'public', multiplicity: '0..*',
      initial_value: '"x"', is_static: true, is_primary_key: true,
    });
    expect(full.text).toBe('+ tags : String [0..*] = "x" {id}');
    expect(full.underline).toBe(true);
  });

  it('operación: parámetros con dirección, retorno, void omitido, abstracta/estática', () => {
    expect(
      formatOperation({ id: '1', name: 'f', return_type: 'int', visibility: 'private', parameters: [{ id: 'p', name: 'x', type: 'int' }] }).text
    ).toBe('- f(x : int) : int');
    expect(
      formatOperation({ id: '2', name: 'g', return_type: 'void', parameters: [{ id: 'p', name: 'o', type: 'T', direction: 'out' }] }).text
    ).toBe('+ g(out o : T)');
    expect(formatOperation({ id: '3', name: 'h', is_abstract: true }).italic).toBe(true);
    expect(formatOperation({ id: '4', name: 'k', is_static: true }).underline).toBe(true);
  });

  it('marcadores: rombo y triángulo en el destino; dependencia es una V abierta', () => {
    const base = { id: 'e', source: 'a', target: 'b', labels: [], points: [{ x: 0, y: 0 }, { x: 0, y: 100 }] };
    const comp = edgeMarkers({ ...base, kind: 'composition' })[0];
    expect(comp.points[0]).toEqual({ x: 0, y: 100 });
    expect(comp.filled).toBe(true);
    expect(edgeMarkers({ ...base, kind: 'aggregation' })[0].filled).toBe(false);
    const gen = edgeMarkers({ ...base, kind: 'generalization' })[0];
    expect(gen.points[0]).toEqual({ x: 0, y: 100 });
    expect(gen.closed && !gen.filled).toBe(true);
    const dep = edgeMarkers({ ...base, kind: 'dependency' })[0];
    expect(dep.closed).toBe(false);
    expect(edgeMarkers({ ...base, kind: 'association' })).toHaveLength(0);
  });

  it('la etiqueta de extremo queda fuera de la línea y a un lado', () => {
    const horizontal = endLabelPos({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(horizontal.y).toBeLessThan(0); // arriba de la línea
    expect(horizontal.x).toBeGreaterThan(0);
    const vertical = endLabelPos({ x: 0, y: 0 }, { x: 0, y: 100 });
    expect(vertical.x).toBeGreaterThan(0); // a la derecha de una línea vertical
  });
});
