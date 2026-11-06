import { describe, expect, it } from 'vitest';
import type { UMLModel } from '../../../types/canonical-model';
import { applyCommands } from '../../uml-commands';
import type { AIPatch } from '../types';
import { patchToCommands } from './patch-to-commands';

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
});
