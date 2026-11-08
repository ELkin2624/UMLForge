import { describe, expect, it } from 'vitest';
import type { UMLModel } from '../../types/canonical-model';
import { applyCommand, applyCommands } from './engine';
import { ABSENT, fingerprintElement, snapshotFingerprints } from './fingerprint';
import type { UMLCommand } from './types';

const emptyModel = (): UMLModel => ({
  classes: [],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
});

const addClass = (id: string, name: string, commandId = `c-${id}`): UMLCommand => ({
  type: 'addClass',
  commandId,
  id,
  name,
  attributes: [{ id: `${id}-a1`, name: 'id', type: 'Long', visibility: 'private' }],
});

function base(): UMLModel {
  const r = applyCommands(emptyModel(), [addClass('u', 'Usuario'), addClass('p', 'Pedido')]);
  if (!r.ok) throw new Error(r.message);
  return r.model;
}

describe('uml-commands: validaciones', () => {
  it('rechaza nombres vacíos y repetidos (sin distinguir mayúsculas)', () => {
    const m = base();
    expect(applyCommand(m, addClass('x', '  ')).ok).toBe(false);
    const dup = applyCommand(m, addClass('x', 'usuario'));
    expect(dup).toMatchObject({ ok: false, code: 'DUPLICATE_NAME' });
  });

  it('rechaza ids repetidos, relaciones a clases inexistentes y tipos inválidos', () => {
    const m = base();
    expect(applyCommand(m, addClass('u', 'Otra'))).toMatchObject({ code: 'ALREADY_EXISTS' });
    const rel = (type: string, target: string): UMLCommand => ({
      type: 'addRelationship',
      commandId: `r-${type}-${target}`,
      relationship: { id: 'r1', source_id: 'u', target_id: target, type },
    });
    expect(applyCommand(m, rel('association', 'zzz'))).toMatchObject({ code: 'NOT_FOUND' });
    expect(applyCommand(m, rel('amistad', 'p'))).toMatchObject({ code: 'INVALID' });
  });

  it('valida atributos: duplicados, tipo vacío y visibilidad', () => {
    const m = base();
    const add = (attribute: object): UMLCommand => ({
      type: 'addAttribute',
      commandId: Math.random().toString(),
      classId: 'u',
      attribute: attribute as never,
    });
    expect(applyCommand(m, add({ id: 'n', name: 'ID', type: 'Long' }))).toMatchObject({
      code: 'DUPLICATE_NAME',
    });
    expect(applyCommand(m, add({ id: 'n', name: 'nombre', type: '' }))).toMatchObject({ code: 'INVALID' });
    expect(
      applyCommand(m, add({ id: 'n', name: 'nombre', type: 'String', visibility: 'secreto' })),
    ).toMatchObject({ code: 'INVALID' });
  });

  it('no muta el modelo original', () => {
    const m = base();
    const snapshot = JSON.stringify(m);
    applyCommand(m, { type: 'renameClass', commandId: 'r', id: 'u', name: 'Cliente' });
    expect(JSON.stringify(m)).toBe(snapshot);
  });
});

describe('uml-commands: idempotencia', () => {
  it('un commandId ya aplicado no vuelve a tener efecto', () => {
    const cmd = addClass('x', 'Nueva', 'cmd-1');
    const first = applyCommand(emptyModel(), cmd);
    if (!first.ok) throw new Error(first.message);
    const again = applyCommand(first.model, cmd, { applied: new Set(['cmd-1']) });
    expect(again).toMatchObject({ ok: true, duplicate: true });
    if (again.ok) expect(again.model.classes).toHaveLength(1);
  });

  it('en un lote, repetir el mismo commandId se ignora', () => {
    const cmd = addClass('x', 'Nueva', 'cmd-1');
    const r = applyCommands(emptyModel(), [cmd, cmd]);
    expect(r.ok && r.model.classes).toHaveLength(1);
  });
});

describe('uml-commands: conflictos por huella', () => {
  it('acepta si el elemento no cambió y rechaza si cambió', () => {
    const m = base();
    const expected = snapshotFingerprints(m, ['u']);
    const rename: UMLCommand = { type: 'renameClass', commandId: 'rn', id: 'u', name: 'Cliente', expected };
    expect(applyCommand(m, rename).ok).toBe(true);

    // otra persona renombró la clase mientras el agente pensaba
    const changed = applyCommand(m, { type: 'renameClass', commandId: 'h', id: 'u', name: 'Persona' });
    if (!changed.ok) throw new Error(changed.message);
    expect(applyCommand(changed.model, rename)).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('ABSENT exige que el elemento aún no exista', () => {
    const m = base();
    const cmd = { ...addClass('nuevo', 'Otra'), expected: { nuevo: ABSENT } };
    expect(applyCommand(m, cmd).ok).toBe(true);
    expect(fingerprintElement(m, 'nuevo')).toBe(ABSENT);
    expect(applyCommand(m, { ...addClass('u2', 'Dos'), expected: { u: ABSENT } })).toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('la huella no depende del orden de las claves', () => {
    const a = { ...emptyModel(), classes: [{ id: 'k', name: 'K', attributes: [], operations: [] }] };
    const b = { ...emptyModel(), classes: [{ operations: [], attributes: [], name: 'K', id: 'k' }] };
    expect(fingerprintElement(a, 'k')).toBe(fingerprintElement(b as UMLModel, 'k'));
  });
});

describe('uml-commands: lotes atómicos e inversos', () => {
  it('si un comando del lote falla, no se aplica ninguno', () => {
    const m = base();
    const r = applyCommands(m, [
      addClass('n', 'Nueva'),
      { type: 'deleteClass', commandId: 'bad', id: 'no-existe' },
    ]);
    expect(r).toMatchObject({ ok: false, code: 'NOT_FOUND', commandId: 'bad' });
  });

  it('el inverso de un lote devuelve el modelo idéntico', () => {
    let m = base();
    const rel: UMLCommand = {
      type: 'addRelationship',
      commandId: 'rel',
      relationship: {
        id: 'r1',
        source_id: 'u',
        target_id: 'p',
        type: 'association',
        source_multiplicity: '1',
        target_multiplicity: '*',
      },
    };
    const setup = applyCommand(m, rel);
    if (!setup.ok) throw new Error(setup.message);
    m = setup.model;
    const original = JSON.stringify(m);

    const batch: UMLCommand[] = [
      { type: 'addAttribute', commandId: 'a', classId: 'u', attribute: { id: 'nn', name: 'nombre', type: 'String' }, index: 0 },
      { type: 'updateAttribute', commandId: 'b', classId: 'u', attributeId: 'u-a1', changes: { type: 'Integer', visibility: 'public' } },
      { type: 'updateRelationship', commandId: 'c', id: 'r1', changes: { target_multiplicity: '0..*' } },
      { type: 'renameClass', commandId: 'd', id: 'p', name: 'Orden' },
      { type: 'deleteAttribute', commandId: 'e', classId: 'u', attributeId: 'u-a1' },
      { type: 'deleteClass', commandId: 'f', id: 'p' }, // borra también la relación r1
    ];
    const applied = applyCommands(m, batch);
    if (!applied.ok) throw new Error(applied.message);
    expect(applied.model.classes.map((c) => c.id)).toEqual(['u']);
    expect(applied.model.relationships).toHaveLength(0);

    const undone = applyCommands(applied.model, applied.inverse);
    if (!undone.ok) throw new Error(undone.message);
    expect(JSON.stringify(undone.model)).toBe(original);
  });

  it('el inverso de cada comando simple restaura el modelo', () => {
    const m = base();
    const cmds: UMLCommand[] = [
      addClass('z', 'Zeta'),
      { type: 'renameClass', commandId: 'r', id: 'u', name: 'Cliente' },
      { type: 'deleteClass', commandId: 'd', id: 'u' },
    ];
    for (const cmd of cmds) {
      const forward = applyCommand(m, cmd);
      if (!forward.ok) throw new Error(forward.message);
      const back = applyCommands(forward.model, forward.inverse);
      if (!back.ok) throw new Error(back.message);
      expect(JSON.stringify(back.model)).toBe(JSON.stringify(m));
    }
  });
});
