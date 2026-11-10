import { describe, it, expect } from 'vitest';
import type { ApollonEditor } from '@tumaet/apollon';
import {
  applyCanonicalModelToApollon,
  autoLayoutApollonModel,
  canonicalToApollon,
  classNaturalHeight,
  keptSize,
  CLASS_DEFAULT_WIDTH,
} from './apollon-adapter';
import type { UMLModel } from '../types/canonical-model';

type Node = ReturnType<typeof canonicalToApollon>['nodes'][number];

const attr = (id: string) => ({ id, name: id, type: 'String', visibility: 'private' });
const model = (attrs: number, extra: Partial<UMLModel> = {}): UMLModel =>
  ({
    id: 'm', name: 'm', relationships: [], components: [], interfaces: [], diagrams: [],
    classes: [{ id: 'c1', name: 'Cliente', attributes: Array.from({ length: attrs }, (_, i) => attr(`a${i}`)), operations: [] }],
    ...extra,
  }) as unknown as UMLModel;

/** Editor mínimo: solo guarda el último modelo asignado. */
const fakeEditor = (nodes: Node[]) => {
  const editor = { model: { nodes, edges: [] } as unknown } as { model: { nodes: Node[] } };
  return editor as unknown as ApollonEditor & { model: { nodes: Node[] } };
};

describe('tamaño de las clases', () => {
  it('usa la medida de Apollon (cabecera 40 + 30 por fila) y measured coherente', () => {
    const [node] = canonicalToApollon(model(2)).nodes;
    expect(node.width).toBe(CLASS_DEFAULT_WIDTH);
    expect(node.height).toBe(classNaturalHeight(2));
    expect(classNaturalHeight(2)).toBe(100);
    expect(node.measured).toEqual({ width: node.width, height: node.height });
  });

  it('el auto-acomodo coloca las clases pero no cambia su tamaño', () => {
    const { nodes, edges } = canonicalToApollon(model(1));
    nodes[0].width = 370;
    nodes[0].height = 90;
    autoLayoutApollonModel(nodes, edges);
    expect([nodes[0].width, nodes[0].height]).toEqual([370, 90]);
  });

  it('al volver a aplicar el modelo conserva el ancho y alto que puso el usuario', () => {
    const [existing] = canonicalToApollon(model(1)).nodes;
    const editor = fakeEditor([{ ...existing, width: 370, height: 120, position: { x: 50, y: 60 } }]);
    applyCanonicalModelToApollon(editor, model(1), 'class');
    const [node] = editor.model.nodes;
    expect([node.width, node.height]).toEqual([370, 120]);
    expect(node.measured).toEqual({ width: 370, height: 120 });
    expect(node.position).toEqual({ x: 50, y: 60 });
  });

  it('al agregar un atributo crece una fila conservando el espacio extra del usuario', () => {
    const [existing] = canonicalToApollon(model(1)).nodes;
    const size = keptSize({ ...existing, width: 300, height: 150 }, canonicalToApollon(model(2)).nodes[0]);
    expect(size).toMatchObject({ width: 300, height: 180 });
  });

  it('nunca queda más bajo que su contenido', () => {
    const [existing] = canonicalToApollon(model(3)).nodes;
    const size = keptSize({ ...existing, height: 40 }, canonicalToApollon(model(5)).nodes[0]);
    expect(size.height).toBe(classNaturalHeight(5));
  });

  it('el tamaño guardado en el servidor tiene prioridad', () => {
    const [existing] = canonicalToApollon(model(1)).nodes;
    const size = keptSize({ ...existing, width: 300 }, existing, { x: 0, y: 0, width: 410, height: 200 });
    expect(size).toMatchObject({ width: 410, height: 200 });
  });

  it('una clase nueva que llega con tamaño guardado lo respeta', () => {
    const editor = fakeEditor([]);
    applyCanonicalModelToApollon(editor, model(1), 'class', { c1: { x: 10, y: 20, width: 333, height: 144 } });
    const [node] = editor.model.nodes;
    expect([node.width, node.height, node.position.x, node.position.y]).toEqual([333, 144, 10, 20]);
  });
});

describe('id del modelo', () => {
  it('el id del servidor manda sobre el id interno de Apollon', async () => {
    const { apollonToCanonical } = await import('./apollon-adapter');
    const apollonModel = { ...canonicalToApollon(model(1)), id: 'id-local-apollon' };
    const out = apollonToCanonical(apollonModel, { ...model(1), id: 'id-del-servidor' });
    expect(out.id).toBe('id-del-servidor');
  });
});
