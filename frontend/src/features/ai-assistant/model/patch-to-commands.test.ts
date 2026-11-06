import { describe, expect, it } from 'vitest';
import type { UMLModel } from '../../../types/canonical-model';
import { applyCommands } from '../../uml-commands';
import type { AIPatch } from '../types';
import { captureBase, patchToCommands } from './patch-to-commands';

const model = (): UMLModel => ({
  classes: [
    { id: 'u', name: 'Usuario', attributes: [], operations: [] },
    { id: 'p', name: 'Pedido', attributes: [], operations: [] },
  ],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
});
let n = 0;
const newId = () => `id${++n}`;
const patch = (over: Partial<AIPatch>): AIPatch => ({
  patch_id: 'p1',
  operation: 'ADD_CLASS',
  target: 'Producto',
  data: {},
  reason: '',
  requested_by: 'ana',
  status: 'pending_approval',
  ...over,
});

describe('patchToCommands', () => {
  it('ADD_CLASS crea la clase con atributos únicos y es idempotente', () => {
    const t = patchToCommands(model(), patch({ data: { attributes: ['nombre', { name: 'Nombre' }, { name: 'precio', type: 'Double' }] } }), newId);
    if (!t.ok) throw new Error(t.message);
    const r = applyCommands(model(), t.commands);
    if (!r.ok) throw new Error(r.message);
    expect(r.model.classes.at(-1)?.attributes.map((a) => a.name)).toEqual(['nombre', 'precio']);
    const again = applyCommands(r.model, t.commands, { applied: new Set(t.commands.map((c) => c.commandId)) });
    expect(again.ok && again.duplicate).toBe(true);
  });

  it('ADD_CLASS sobre una clase existente no hace nada', () => {
    expect(patchToCommands(model(), patch({ target: 'usuario' }), newId)).toEqual({ ok: true, commands: [] });
  });

  it('ADD_RELATION resuelve nombres a ids y avisa si falta una clase', () => {
    const ok = patchToCommands(model(), patch({ operation: 'ADD_RELATION', data: { source: 'usuario', target: 'PEDIDO', type: 'association' } }), newId);
    if (!ok.ok) throw new Error(ok.message);
    const r = applyCommands(model(), ok.commands);
    expect(r.ok && r.model.relationships[0]).toMatchObject({ source_id: 'u', target_id: 'p', type: 'association' });
    const bad = patchToCommands(model(), patch({ operation: 'ADD_RELATION', data: { source: 'Usuario', target: 'Nada' } }), newId);
    expect(bad.ok).toBe(false);
  });

  it('DELETE_CLASS por nombre y operaciones no soportadas se informan', () => {
    const del = patchToCommands(model(), patch({ operation: 'DELETE_CLASS', target: 'Pedido' }), newId);
    const r = del.ok && applyCommands(model(), del.commands);
    expect(r && r.ok && r.model.classes.map((c) => c.id)).toEqual(['u']);
    expect(patchToCommands(model(), patch({ operation: 'UPDATE_CLASS' }), newId).ok).toBe(false);
  });

  const rich = (): UMLModel => ({
    ...model(),
    classes: [
      {
        id: 'u',
        name: 'Usuario',
        operations: [],
        attributes: [
          { id: 'a1', name: 'nombre', type: 'String', visibility: 'private' },
          { id: 'a2', name: 'edad', type: 'int', visibility: 'private' },
        ],
      },
      { id: 'p', name: 'Pedido', attributes: [], operations: [] },
    ],
    relationships: [
      { id: 'r1', source_id: 'u', target_id: 'p', type: 'association', source_multiplicity: '1', target_multiplicity: '*' },
    ],
  });

  it('UPDATE_CLASS renombra y cambia atributos en un lote con commandIds únicos', () => {
    const t = patchToCommands(
      rich(),
      patch({
        operation: 'UPDATE_CLASS',
        target: 'usuario',
        data: {
          new_name: 'Cliente',
          remove_attributes: ['edad'],
          update_attributes: [{ name: 'nombre', new_name: 'nombreCompleto', type: 'Text' }],
          add_attributes: ['email', { name: 'activo', type: 'boolean' }],
        },
      }),
      newId,
    );
    if (!t.ok) throw new Error(t.message);
    expect(new Set(t.commands.map((c) => c.commandId)).size).toBe(t.commands.length);
    const r = applyCommands(rich(), t.commands);
    if (!r.ok) throw new Error(r.message);
    const cls = r.model.classes[0];
    expect(cls.name).toBe('Cliente');
    expect(cls.attributes.map((a) => [a.name, a.type])).toEqual([
      ['nombreCompleto', 'Text'],
      ['email', 'String'],
      ['activo', 'boolean'],
    ]);
  });

  it('UPDATE_CLASS falla con clase o atributo inexistente y es idempotente al añadir', () => {
    const noClass = patchToCommands(rich(), patch({ operation: 'UPDATE_CLASS', target: 'Nada', data: { new_name: 'X' } }), newId);
    expect(noClass.ok).toBe(false);
    const noAttr = patchToCommands(rich(), patch({ operation: 'UPDATE_CLASS', target: 'Usuario', data: { remove_attributes: ['zzz'] } }), newId);
    expect(noAttr.ok).toBe(false);
    const same = patchToCommands(
      rich(),
      patch({ operation: 'UPDATE_CLASS', target: 'Usuario', data: { add_attributes: ['NOMBRE'], new_name: 'usuario' } }),
      newId,
    );
    expect(same).toEqual({ ok: true, commands: [] });
  });

  it('DELETE_RELATION borra por extremos, es no-op si ya no existe y avisa si es ambigua', () => {
    const del = patchToCommands(rich(), patch({ operation: 'DELETE_RELATION', data: { source: 'Usuario', target: 'Pedido' } }), newId);
    if (!del.ok) throw new Error(del.message);
    const r = applyCommands(rich(), del.commands);
    expect(r.ok && r.model.relationships).toEqual([]);

    const gone = patchToCommands(rich(), patch({ operation: 'DELETE_RELATION', data: { source: 'Pedido', target: 'Usuario' } }), newId);
    expect(gone).toEqual({ ok: true, commands: [] });

    const two = rich();
    two.relationships.push({ ...two.relationships[0], id: 'r2', type: 'dependency' });
    const ambiguous = patchToCommands(two, patch({ operation: 'DELETE_RELATION', data: { source: 'Usuario', target: 'Pedido' } }), newId);
    expect(ambiguous.ok).toBe(false);
    const typed = patchToCommands(
      two,
      patch({ operation: 'DELETE_RELATION', data: { source: 'Usuario', target: 'Pedido', type: 'dependency' } }),
      newId,
    );
    expect(typed.ok).toBe(true);
  });

  it('ADD_RELATION no duplica una relación idéntica', () => {
    const t = patchToCommands(
      rich(),
      patch({ operation: 'ADD_RELATION', data: { source: 'Usuario', target: 'Pedido', type: 'association' } }),
      newId,
    );
    expect(t).toEqual({ ok: true, commands: [] });
  });

  it('con `base`, aprobar tras un cambio ajeno da CONFLICT y no modifica el modelo', () => {
    const p = patch({ operation: 'DELETE_CLASS', target: 'Pedido' });
    p.base = captureBase(rich(), p);
    expect(Object.keys(p.base)).toEqual(['p']);

    // sin cambios ajenos: se aplica
    const ok = patchToCommands(rich(), p, newId);
    if (!ok.ok) throw new Error(ok.message);
    expect(applyCommands(rich(), ok.commands).ok).toBe(true);

    // otra persona añadió un atributo a Pedido tras la propuesta: la huella lo detecta
    const changed = rich();
    changed.classes[1].attributes.push({ id: 'z', name: 'total', type: 'double', visibility: 'private' });
    const stale = patchToCommands(changed, p, newId);
    if (!stale.ok) throw new Error(stale.message);
    const r = applyCommands(changed, stale.commands);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CONFLICT');
  });

  it('captureBase solo cubre elementos existentes que se modifican o borran', () => {
    expect(captureBase(rich(), patch({ operation: 'ADD_CLASS', target: 'Nuevo' }))).toEqual({});
    expect(Object.keys(captureBase(rich(), patch({ operation: 'UPDATE_CLASS', target: 'Usuario' })))).toEqual(['u']);
    const rel = captureBase(rich(), patch({ operation: 'DELETE_RELATION', data: { source: 'Usuario', target: 'Pedido' } }));
    expect(Object.keys(rel)).toEqual(['r1']);
    expect(captureBase(rich(), patch({ operation: 'DELETE_CLASS', target: 'Nada' }))).toEqual({});
  });
});
