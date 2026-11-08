import { describe, expect, it } from 'vitest';
import type { UMLModel } from '../../../types/canonical-model';
import type { AIPatch } from '../types';
import { approveBatch, changedSinceProposal } from './approval';
import { captureBase } from './patch-to-commands';
import { previewPatch } from './preview';

const model = (): UMLModel => ({
  classes: [
    {
      id: 'u',
      name: 'Usuario',
      operations: [],
      attributes: [{ id: 'a1', name: 'nombre', type: 'String', visibility: 'private' }],
    },
    { id: 'p', name: 'Pedido', attributes: [], operations: [] },
  ],
  relationships: [
    { id: 'r1', source_id: 'u', target_id: 'p', type: 'association', source_multiplicity: '1', target_multiplicity: '*' },
  ],
  components: [],
  interfaces: [],
  diagrams: [],
});

let n = 0;
const newId = () => `id${++n}`;
const patch = (over: Partial<AIPatch>): AIPatch => ({
  patch_id: `p${++n}`,
  operation: 'ADD_CLASS',
  target: 'Producto',
  data: {},
  reason: 'test',
  requested_by: 'ana',
  status: 'pending_approval',
  ...over,
});
/** Como en la app: la huella se captura contra el modelo que vio la IA. */
const proposed = (over: Partial<AIPatch>, against = model()) => {
  const p = patch(over);
  return { ...p, base: captureBase(against, p) };
};

describe('approveBatch', () => {
  it('aplica varios parches como un solo lote con inverso conjunto', () => {
    const r = approveBatch(
      model(),
      [
        proposed({ target: 'Producto', data: { attributes: ['precio'] } }),
        proposed({ operation: 'ADD_RELATION', target: '', data: { source: 'Pedido', target: 'Producto', type: 'association' } }),
      ],
      newId,
    );
    if (!r.ok) throw new Error(r.message);
    expect(r.model.classes.map((c) => c.name)).toEqual(['Usuario', 'Pedido', 'Producto']);
    expect(r.model.relationships).toHaveLength(2);
    expect(r.patchIds).toHaveLength(2);
    expect(r.inverse.length).toBeGreaterThanOrEqual(2);
  });

  it('es atómico: si el segundo parche falla, no se aplica ninguno', () => {
    const original = model();
    const r = approveBatch(
      original,
      [
        proposed({ target: 'Producto' }),
        proposed({ operation: 'ADD_RELATION', target: '', data: { source: 'Producto', target: 'NoExiste' } }),
      ],
      newId,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID');
    expect(original.classes).toHaveLength(2); // el modelo recibido no se muta
  });

  it('marca como obsoleta una sugerencia si otra persona tocó el elemento tras proponerla', () => {
    const del = proposed({ operation: 'DELETE_CLASS', target: 'Pedido' });
    const later = model();
    later.classes[1].attributes.push({ id: 'z', name: 'total', type: 'double', visibility: 'private' });
    expect(changedSinceProposal(later, del)).toEqual(['p']);

    const r = approveBatch(later, [del], newId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('STALE');
      expect(r.staleIds).toEqual([del.patch_id]);
    }
    expect(later.classes).toHaveLength(2); // el cambio ajeno queda intacto
  });

  it('con un lote mixto, los obsoletos bloquean TODO y se informan todos', () => {
    const ok = proposed({ target: 'Producto' });
    const stale1 = proposed({ operation: 'DELETE_CLASS', target: 'Pedido' });
    const stale2 = proposed({ operation: 'UPDATE_CLASS', target: 'Usuario', data: { new_name: 'Cliente' } });
    const later = model();
    later.classes[0].name = 'Usuario';
    later.classes[0].attributes.push({ id: 'q', name: 'email', type: 'String', visibility: 'private' });
    later.classes[1].attributes.push({ id: 'z', name: 'total', type: 'double', visibility: 'private' });
    const r = approveBatch(later, [ok, stale1, stale2], newId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.staleIds.sort()).toEqual([stale1.patch_id, stale2.patch_id].sort());
  });

  it('dos parches del mismo lote pueden tocar la misma clase', () => {
    const a = proposed({ operation: 'UPDATE_CLASS', target: 'Usuario', data: { add_attributes: ['email'] } });
    const b = proposed({ operation: 'UPDATE_CLASS', target: 'Usuario', data: { add_attributes: ['edad'] } });
    const r = approveBatch(model(), [a, b], newId);
    if (!r.ok) throw new Error(r.message);
    expect(r.model.classes[0].attributes.map((x) => x.name)).toEqual(['nombre', 'email', 'edad']);
  });

  it('aplicar el mismo lote dos veces no duplica (idempotente por nombre)', () => {
    const first = approveBatch(model(), [proposed({ target: 'Producto' })], newId);
    if (!first.ok) throw new Error(first.message);
    const again = approveBatch(first.model, [proposed({ target: 'Producto' })], newId);
    if (!again.ok) throw new Error(again.message);
    expect(again.model.classes.filter((c) => c.name === 'Producto')).toHaveLength(1);
  });
});

describe('previewPatch', () => {
  it('describe altas, cambios y bajas sin modificar el modelo', () => {
    const m = model();
    const snapshot = JSON.stringify(m);

    const add = previewPatch(m, patch({ target: 'Producto', data: { attributes: [{ name: 'precio', type: 'Double' }] } }));
    expect(add).toEqual({
      ok: true,
      lines: [
        { kind: 'add', text: 'Clase Producto', depth: 0 },
        { kind: 'add', text: 'precio: Double', depth: 1 },
      ],
    });

    const upd = previewPatch(
      m,
      patch({
        operation: 'UPDATE_CLASS',
        target: 'Usuario',
        data: { new_name: 'Cliente', remove_attributes: ['nombre'], add_attributes: ['email'] },
      }),
    );
    if (!upd.ok) throw new Error(upd.message);
    expect(upd.lines.map((l) => [l.kind, l.text])).toEqual([
      ['change', 'Renombrar Usuario → Cliente'],
      ['remove', 'Usuario: − nombre'],
      ['add', 'Usuario: + email: String'],
    ]);

    const del = previewPatch(m, patch({ operation: 'DELETE_CLASS', target: 'Pedido' }));
    if (!del.ok) throw new Error(del.message);
    expect(del.lines.map((l) => l.text)).toEqual(['Eliminar clase Pedido', 'y 1 relación(es) asociada(s)']);

    expect(JSON.stringify(m)).toBe(snapshot);
  });

  it('informa cuando no se puede aplicar o ya está aplicado', () => {
    expect(previewPatch(model(), patch({ operation: 'UPDATE_CLASS', target: 'Nada', data: {} })).ok).toBe(false);
    const done = previewPatch(model(), patch({ target: 'usuario' }));
    expect(done).toEqual({ ok: true, lines: [{ kind: 'change', text: 'Sin cambios: ya está aplicado.', depth: 0 }] });
  });
});
