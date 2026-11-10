import { describe, it, expect } from 'vitest';
import type { UMLModel } from '@tumaet/apollon';
import {
  applyVisualStateToModel,
  extractVisualStateFromModel,
  getVisualStateDelta,
} from './visual-state-manager';
import { applyRoomBatch } from '../../../../../packages/uml-commands/coordinator.ts';
import type { UMLModel as Canonical } from '../../../types/canonical-model';

const apollon = (width: number, height: number) =>
  ({ nodes: [{ id: 'c1', position: { x: 10, y: 20 }, width, height }] }) as unknown as UMLModel;

describe('estado visual con tamaño', () => {
  it('extrae posición y tamaño redondeado', () => {
    expect(extractVisualStateFromModel(apollon(370.4, 120))).toEqual({ c1: { x: 10, y: 20, width: 370, height: 120 } });
  });

  it('un cambio solo de tamaño cuenta como cambio', () => {
    const delta = getVisualStateDelta({ c1: { x: 10, y: 20, width: 220, height: 100 } }, { c1: { x: 10, y: 20, width: 370, height: 100 } });
    expect(delta).toEqual({ c1: { x: 10, y: 20, width: 370, height: 100 } });
  });

  it('aplica el tamaño recibido y mantiene measured igual', () => {
    const out = applyVisualStateToModel(apollon(220, 100), { c1: { x: 1, y: 2, width: 300, height: 150 } });
    expect(out.nodes[0]).toMatchObject({ position: { x: 1, y: 2 }, width: 300, height: 150, measured: { width: 300, height: 150 } });
  });
});

describe('motor compartido: tamaño en la posición', () => {
  const model = { classes: [{ id: 'c1', name: 'A', attributes: [], operations: [] }], relationships: [] } as unknown as Canonical;
  const move = (after: object) => [{ type: 'moveClass' as const, commandId: 'k', id: 'c1', before: null, after: after as { x: number; y: number } }];

  it('guarda el tamaño junto a la posición', () => {
    const result = applyRoomBatch(model, {}, move({ x: 5, y: 6, width: 300, height: 140 }));
    expect(result.ok && result.layout).toEqual({ c1: { x: 5, y: 6, width: 300, height: 140 } });
  });

  it('rechaza tamaños inválidos', () => {
    for (const bad of [{ width: -1 }, { height: 0 }, { width: 1e9 }, { height: Number.NaN }]) {
      expect(applyRoomBatch(model, {}, move({ x: 0, y: 0, ...bad })).ok).toBe(false);
    }
  });
});
