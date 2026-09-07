import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateModel } from '../../src/api/models-api';
import { UMLModel } from '../../src/types/canonical-model';

// Mock del cliente fetch nativo
globalThis.fetch = vi.fn();

describe('models-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería llamar a /api/v1/models/validate con el modelo correcto', async () => {
    const mockModel: UMLModel = { id: 'test', name: 'test', classes: [], relationships: [], components: [], interfaces: [], diagrams: [] };
    const mockResponse = { is_valid: true, errors: [] };
    
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await validateModel(mockModel);
    
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/models/validate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(mockModel)
    }));
    expect(result).toEqual(mockResponse);
  });

  it('debería llamar a /api/v1/projects/validate-e2e con el modelo correcto', async () => {
    const mockModel: UMLModel = { id: 'test', name: 'barberia', classes: [], relationships: [], components: [], interfaces: [], diagrams: [] };
    const mockE2EResult = {
      success: true,
      project_name: 'barberia',
      total_duration_ms: 15400,
      stages: [
        { name: 'validation', status: 'success', duration_ms: 50, error: null, logs: null }
      ],
      test_summary: { total: 21, passed: 21, failed: 0, skipped: 0 }
    };
    
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockE2EResult
    });

    const { validateE2E } = await import('../../src/api/models-api');
    const result = await validateE2E(mockModel);
    
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/projects/validate-e2e', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(mockModel)
    }));
    expect(result).toEqual(mockE2EResult);
  });

  it('debería lanzar error con el detalle cuando la respuesta no es ok', async () => {
    const mockModel: UMLModel = { id: 'test', name: 'error-model', classes: [], relationships: [], components: [], interfaces: [], diagrams: [] };
    
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Modelo UML no válido' })
    });

    const { validateE2E } = await import('../../src/api/models-api');
    await expect(validateE2E(mockModel)).rejects.toThrow('Modelo UML no válido');
  });
});


