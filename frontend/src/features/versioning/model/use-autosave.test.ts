import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModelStore } from '../../../store/model-store';
import { useShareStore } from '../../sharing/model/share-store';
import { useVersioningStore } from './versioning-store';
import { markAiChange } from './save-source';
import { useAutosave, AUTOSAVE_DEBOUNCE_MS } from './use-autosave';
import * as api from '../../../api/diagrams-api';
import type { UMLModel } from '../../../types/canonical-model';

const model = (name: string) =>
  ({ id: 'm', name: 'M', classes: [{ id: name, name, attributes: [], operations: [] }] }) as unknown as UMLModel;

describe('useAutosave', () => {
  let save: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    save = vi.spyOn(api, 'saveDiagram').mockResolvedValue({
      id: 1, name: 'D', data: model('A'), version: 2, version_created: true, my_role: 'OWNER',
    });
    useModelStore.setState({ model: null });
    useShareStore.getState().setRoomId('1');
    useShareStore.getState().setLocalRole('OWNER');
    useVersioningStore.setState({ saveState: 'idle', historyRefreshKey: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('guarda una sola vez tras el debounce aunque haya varios cambios', async () => {
    renderHook(() => useAutosave());
    useModelStore.getState().setModel(model('A'));
    useModelStore.getState().setModel(model('B'));
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toEqual(model('B'));
    expect(save.mock.calls[0][2]).toBe('user');
    expect(useVersioningStore.getState().saveState).toBe('saved');
    expect(useVersioningStore.getState().historyRefreshKey).toBe(1);
  });

  it('no guarda cambios remotos', async () => {
    renderHook(() => useAutosave());
    useModelStore.getState().setModelFromRemote(model('A'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it('no guarda si el rol es lector', async () => {
    useShareStore.getState().setLocalRole('READER');
    renderHook(() => useAutosave());
    useModelStore.getState().setModel(model('A'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it('no guarda sin diagrama activo', async () => {
    useShareStore.getState().setRoomId(null as unknown as string);
    renderHook(() => useAutosave());
    useModelStore.getState().setModel(model('A'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it('atribuye a la IA cuando se marcó el cambio', async () => {
    renderHook(() => useAutosave());
    markAiChange();
    useModelStore.getState().setModel(model('MetodoPago'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(save.mock.calls[0][2]).toBe('ai');
  });

  it('no repite el guardado si el modelo no cambió', async () => {
    renderHook(() => useAutosave());
    useModelStore.getState().setModel(model('A'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    useModelStore.getState().setModel(model('A')); // misma estructura, otra referencia
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reintenta y marca error si falla', async () => {
    save.mockRejectedValueOnce(new Error('503'));
    renderHook(() => useAutosave());
    useModelStore.getState().setModel(model('A'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(useVersioningStore.getState().saveState).toBe('error');
    await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(useVersioningStore.getState().saveState).toBe('saved');
  });
});
