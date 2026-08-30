import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useE2EValidation } from '../../src/hooks/use-e2e-validation';
import { useModelStore } from '../../src/store/model-store';
import * as modelsApi from '../../src/api/models-api';
import { E2EResult } from '../../src/types/api-responses';
import { UMLModel } from '../../src/types/canonical-model';

vi.mock('../../src/api/models-api', () => ({
  validateE2E: vi.fn(),
  validateModel: vi.fn(),
  generateProject: vi.fn(),
  deployProject: vi.fn(),
}));

describe('useE2EValidation', () => {
  const mockModel: UMLModel = {
    id: 'm-barberia',
    name: 'barberia',
    classes: [],
    relationships: [],
    components: [],
    interfaces: [],
    diagrams: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useModelStore.getState().resetE2E();
    useModelStore.setState({ model: null });
  });

  it('debería tener estado inicial idle', () => {
    const { result } = renderHook(() => useE2EValidation());

    expect(result.current.e2eState).toBe('idle');
    expect(result.current.e2eResult).toBeNull();
    expect(result.current.e2eError).toBeNull();
  });

  it('debería fallar si no hay modelo cargado', async () => {
    const { result } = renderHook(() => useE2EValidation());

    await act(async () => {
      await result.current.runE2EValidation();
    });

    expect(result.current.e2eState).toBe('failure');
    expect(result.current.e2eError).toBe('No hay modelo para validar');
    expect(modelsApi.validateE2E).not.toHaveBeenCalled();
  });

  it('debería transitar idle -> running -> success cuando la API responde success=true', async () => {
    useModelStore.setState({ model: mockModel });

    const mockE2EResult: E2EResult = {
      success: true,
      project_name: 'barberia',
      total_duration_ms: 18500,
      stages: [
        { name: 'validation', status: 'success', duration_ms: 10, error: null, logs: null },
        { name: 'generation', status: 'success', duration_ms: 200, error: null, logs: null },
        { name: 'extraction', status: 'success', duration_ms: 50, error: null, logs: null },
        { name: 'postgres', status: 'success', duration_ms: 5000, error: null, logs: null },
        { name: 'maven', status: 'success', duration_ms: 10000, error: null, logs: null },
        { name: 'spring', status: 'success', duration_ms: 10, error: null, logs: null },
        { name: 'health', status: 'success', duration_ms: 2000, error: null, logs: null },
        { name: 'newman', status: 'success', duration_ms: 1200, error: null, logs: null },
      ],
      test_summary: { total: 21, passed: 21, failed: 0, skipped: 0 },
    };

    (modelsApi.validateE2E as any).mockResolvedValue(mockE2EResult);

    const { result } = renderHook(() => useE2EValidation());

    await act(async () => {
      await result.current.runE2EValidation();
    });

    expect(modelsApi.validateE2E).toHaveBeenCalledWith(mockModel);
    expect(result.current.e2eState).toBe('success');
    expect(result.current.e2eResult).toEqual(mockE2EResult);
    expect(result.current.e2eError).toBeNull();
    expect(result.current.e2eStartedAt).toBeTypeOf('number');
    expect(result.current.e2eCompletedAt).toBeTypeOf('number');
  });

  it('debería transitar a failure cuando la API responde success=false (fallo en pipeline)', async () => {
    useModelStore.setState({ model: mockModel });

    const mockFailureResult: E2EResult = {
      success: false,
      project_name: 'barberia',
      total_duration_ms: 8000,
      stages: [
        { name: 'validation', status: 'success', duration_ms: 10, error: null, logs: null },
        { name: 'maven', status: 'failure', duration_ms: 7000, error: 'Fallo en compilación', logs: 'error log' },
      ],
      test_summary: null,
    };

    (modelsApi.validateE2E as any).mockResolvedValue(mockFailureResult);

    const { result } = renderHook(() => useE2EValidation());

    await act(async () => {
      await result.current.runE2EValidation();
    });

    expect(result.current.e2eState).toBe('failure');
    expect(result.current.e2eResult).toEqual(mockFailureResult);
    expect(result.current.e2eError).toBeNull();
  });

  it('debería capturar y categorizar errores de red diferenciadamente', async () => {
    useModelStore.setState({ model: mockModel });

    (modelsApi.validateE2E as any).mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() => useE2EValidation());

    await act(async () => {
      await result.current.runE2EValidation();
    });

    expect(result.current.e2eState).toBe('failure');
    expect(result.current.e2eError).toBe('No se pudo conectar con el servidor');
  });

  it('debería capturar errores de validación HTTP (ej. 422)', async () => {
    useModelStore.setState({ model: mockModel });

    (modelsApi.validateE2E as any).mockRejectedValue(new Error('Error de validación del modelo UML'));

    const { result } = renderHook(() => useE2EValidation());

    await act(async () => {
      await result.current.runE2EValidation();
    });

    expect(result.current.e2eState).toBe('failure');
    expect(result.current.e2eError).toBe('Error de validación del modelo UML');
  });
});
