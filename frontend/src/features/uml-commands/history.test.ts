import { describe, expect, it } from 'vitest';
import type { UMLModel } from '../../types/canonical-model';
import { applyCommands } from './engine';
import { emptyHistory, MAX_HISTORY, recordEntry, redo, undo, type HistoryState } from './history';
import type { UMLCommand } from './types';

const base = (): UMLModel => ({
  classes: [{ id: 'u', name: 'Usuario', attributes: [], operations: [] }],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
});

/** Aplica comandos y los registra, como hace la aprobación de un parche. */
function apply(model: UMLModel, state: HistoryState, id: string, commands: UMLCommand[]) {
  const r = applyCommands(model, commands);
  if (!r.ok) throw new Error(r.message);
  const next = recordEntry(
    state,
    { id, label: id, author: 'ai', forward: commands, inverse: r.inverse, touched: r.touched },
    r.model,
  );
  return { model: r.model, state: next };
}

const addClass = (id: string, name: string): UMLCommand => ({
  type: 'addClass',
  commandId: `c-${id}`,
  id,
  name,
});

describe('historial deshacer/rehacer', () => {
  it('deshace y rehace un cambio', () => {
    const { model, state } = apply(base(), emptyHistory(), 'a', [addClass('p', 'Pedido')]);
    expect(model.classes.map((c) => c.id)).toEqual(['u', 'p']);

    const u = undo(state, model);
    if (!u.ok) throw new Error(u.message);
    expect(u.model.classes.map((c) => c.id)).toEqual(['u']);
    expect(u.state.undoStack).toHaveLength(0);
    expect(u.state.redoStack).toHaveLength(1);

    const r = redo(u.state, u.model);
    if (!r.ok) throw new Error(r.message);
    expect(r.model.classes.map((c) => c.id)).toEqual(['u', 'p']);
    expect(r.state.undoStack).toHaveLength(1);
    // se puede deshacer otra vez tras rehacer
    expect(undo(r.state, r.model).ok).toBe(true);
  });

  it('deshace en orden inverso (pila)', () => {
    let m = base();
    let s = emptyHistory();
    ({ model: m, state: s } = apply(m, s, 'a', [addClass('p', 'Pedido')]));
    ({ model: m, state: s } = apply(m, s, 'b', [addClass('q', 'Producto')]));
    const u1 = undo(s, m);
    if (!u1.ok) throw new Error(u1.message);
    expect(u1.entry.id).toBe('b');
    const u2 = undo(u1.state, u1.model);
    if (!u2.ok) throw new Error(u2.message);
    expect(u2.entry.id).toBe('a');
    expect(u2.model.classes.map((c) => c.id)).toEqual(['u']);
  });

  it('deshacer un borrado restaura la clase y sus relaciones', () => {
    const m0: UMLModel = {
      ...base(),
      classes: [
        {
          id: 'u',
          name: 'Usuario',
          attributes: [{ id: 'a1', name: 'nombre', type: 'String', visibility: 'private' }],
          operations: [],
        },
        { id: 'p', name: 'Pedido', attributes: [], operations: [] },
      ],
      relationships: [
        { id: 'r', source_id: 'u', target_id: 'p', type: 'association', source_multiplicity: '1', target_multiplicity: '*' },
      ],
    };
    const { model, state } = apply(m0, emptyHistory(), 'del', [{ type: 'deleteClass', commandId: 'd', id: 'p' }]);
    expect(model.relationships).toHaveLength(0);
    const u = undo(state, model);
    if (!u.ok) throw new Error(u.message);
    expect(u.model).toEqual(m0);
  });

  it('rechaza deshacer si otra persona modificó el elemento (CONFLICT) y no cambia nada', () => {
    const { model, state } = apply(base(), emptyHistory(), 'a', [addClass('p', 'Pedido')]);
    const tampered = applyCommands(model, [{ type: 'renameClass', commandId: 'x', id: 'p', name: 'Orden' }]);
    if (!tampered.ok) throw new Error(tampered.message);
    const u = undo(state, tampered.model);
    expect(u.ok).toBe(false);
    if (!u.ok) expect(u.code).toBe('CONFLICT');
    expect(tampered.model.classes.map((c) => c.name)).toEqual(['Usuario', 'Orden']);
  });

  it('cambios ajenos sobre OTROS elementos no bloquean el deshacer', () => {
    const { model, state } = apply(base(), emptyHistory(), 'a', [addClass('p', 'Pedido')]);
    const other = applyCommands(model, [{ type: 'renameClass', commandId: 'x', id: 'u', name: 'Cliente' }]);
    if (!other.ok) throw new Error(other.message);
    const u = undo(state, other.model);
    expect(u.ok).toBe(true);
    if (u.ok) expect(u.model.classes.map((c) => c.name)).toEqual(['Cliente']);
  });

  it('rechaza rehacer si el elemento cambió tras deshacer', () => {
    const { model, state } = apply(base(), emptyHistory(), 'a', [addClass('p', 'Pedido')]);
    const u = undo(state, model);
    if (!u.ok) throw new Error(u.message);
    // alguien crea otra clase con el mismo id: la huella ya no es "ausente"
    const other = applyCommands(u.model, [addClass('p', 'Otro')]);
    if (!other.ok) throw new Error(other.message);
    const r = redo(u.state, other.model);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CONFLICT');
  });

  it('un cambio nuevo vacía el rehacer, y una pila vacía devuelve EMPTY', () => {
    const { model, state } = apply(base(), emptyHistory(), 'a', [addClass('p', 'Pedido')]);
    const u = undo(state, model);
    if (!u.ok) throw new Error(u.message);
    const again = apply(u.model, u.state, 'b', [addClass('q', 'Producto')]);
    expect(again.state.redoStack).toHaveLength(0);
    const empty = undo(emptyHistory(), base());
    expect(!empty.ok && empty.code).toBe('EMPTY');
    const emptyRedo = redo(emptyHistory(), base());
    expect(!emptyRedo.ok && emptyRedo.code).toBe('EMPTY');
  });

  it('limita el tamaño del historial y no registra cambios nulos', () => {
    let m = base();
    let s = emptyHistory();
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      ({ model: m, state: s } = apply(m, s, `e${i}`, [addClass(`k${i}`, `Clase${i}`)]));
    }
    expect(s.undoStack).toHaveLength(MAX_HISTORY);
    expect(s.undoStack[0].id).toBe('e5');
    const same = recordEntry(s, { id: 'noop', label: 'noop', author: 'ai', forward: [], inverse: [], touched: [] }, m);
    expect(same).toBe(s);
  });
});
