import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from '../../../api/diagrams-api';
import { useModelStore } from '../../../store/model-store';
import { useShareStore } from '../../sharing/model/share-store';
import * as collab from '../../collaboration';
import { switchToDiagram } from './switch-diagram';
import type { UMLModel } from '../../../types/canonical-model';

const withClass = (name: string) =>
  ({ id: name, name, classes: [{ id: name }], relationships: [], components: [], interfaces: [], diagrams: [] }) as unknown as UMLModel;

const detail = (id: number, data: UMLModel, role = 'EDITOR') =>
  ({ id, name: `D${id}`, data, version: 1, version_created: null, my_role: role }) as api.DiagramSaveResult;

describe('switchToDiagram', () => {
  let order: string[];
  let disconnect: ReturnType<typeof vi.fn>;
  let connect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    order = [];
    disconnect = vi.fn(() => { order.push('disconnect'); });
    connect = vi.fn((room: string) => { order.push(`connect:${room}`); });
    vi.spyOn(collab, 'getSharedCollaborationManager').mockReturnValue({ disconnect, connect } as never);
    vi.spyOn(api, 'saveDiagram').mockImplementation(async (room) => {
      order.push(`save:${room}`);
      return detail(Number(room), withClass('x'));
    });
    useShareStore.getState().setRoomId('1');
    useShareStore.getState().setLocalRole('OWNER');
    useModelStore.setState({ model: withClass('A') });
  });

  afterEach(() => vi.restoreAllMocks());

  it('guarda el actual, cambia roomId y recién entonces carga el modelo nuevo', async () => {
    vi.spyOn(api, 'getDiagram').mockResolvedValue(detail(2, withClass('B'), 'READER'));
    const seenRoomWhenModelSet: Array<string | null> = [];
    const unsub = useModelStore.subscribe((s) => s.model, () => {
      seenRoomWhenModelSet.push(useShareStore.getState().roomId);
    });

    await switchToDiagram(2);
    unsub();

    // Sin sala el editor queda en solo lectura: abrir un diagrama conecta a la suya.
    expect(order).toEqual(['save:1', 'disconnect', 'connect:2']);
    expect(seenRoomWhenModelSet).toEqual(['2']);
    expect(useShareStore.getState().roomId).toBe('2');
    expect(useShareStore.getState().localRole).toBe('READER');
    expect(useModelStore.getState().model?.name).toBe('B');
    expect(sessionStorage.getItem('umlforge-active-diagram')).toBe('2');
    expect(sessionStorage.getItem('umlforge-collab-active')).toBe('true');
  });

  it('no guarda el actual si el rol es lector', async () => {
    useShareStore.getState().setLocalRole('READER');
    vi.spyOn(api, 'getDiagram').mockResolvedValue(detail(2, withClass('B')));
    await switchToDiagram(2);
    expect(api.saveDiagram).not.toHaveBeenCalled();
  });

  it('un diagrama vacío carga un modelo vacío (no null) para limpiar el lienzo', async () => {
    vi.spyOn(api, 'getDiagram').mockResolvedValue(detail(3, {} as UMLModel));
    await switchToDiagram(3);
    const m = useModelStore.getState().model;
    expect(m).not.toBeNull();
    expect(m?.classes).toEqual([]);
  });

  it('si el destino falla no toca el estado actual', async () => {
    vi.spyOn(api, 'getDiagram').mockRejectedValue(new Error('403'));
    await expect(switchToDiagram(2)).rejects.toThrow('403');
    expect(useShareStore.getState().roomId).toBe('1');
    expect(disconnect).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(useModelStore.getState().model?.name).toBe('A');
  });

  it('no hace nada si ya es el diagrama activo', async () => {
    const get = vi.spyOn(api, 'getDiagram');
    await switchToDiagram(1);
    expect(get).not.toHaveBeenCalled();
  });
});
