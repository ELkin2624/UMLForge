import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateSql } from './api';
import type { UMLModel } from '../../types/canonical-model';

const auth = vi.hoisted(() => ({ token: '', setAuth: vi.fn(), clearAuth: vi.fn() }));
vi.mock('../auth/store', () => ({ useAuthStore: { getState: () => auth } }));
const model = { id: 'demo', classes: [], relationships: [] } as unknown as UMLModel;
const validToken = () => `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }))}.signature`;
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Cliente de descarga SQL', () => {
  it('envía JWT y recibe el archivo binario', async () => {
    auth.token = validToken();
    const blob = new Blob(['sql']);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(blob) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await generateSql(model, 'schema', 3)).toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/models/generate-sql', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ Authorization: `Bearer ${auth.token}` }),
      body: JSON.stringify({ model_data: model, mode: 'schema', rows_per_entity: 3 }),
    }));
  });

  it('refresca y reintenta una descarga cuando recibe 401', async () => {
    auth.token = validToken();
    const blob = new Blob(['zip']);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'nuevo-token', user: {} }) })
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => blob });
    vi.stubGlobal('fetch', fetchMock);
    expect(await generateSql(model, 'both', 3)).toBe(blob);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/refresh');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer nuevo-token');
  });

  it('presenta los errores de validación sin convertirlos en un archivo', async () => {
    auth.token = validToken();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422,
      text: async () => JSON.stringify({ detail: 'Invalid UML Model', errors: [{ message: 'Referencia inexistente' }] }),
    }));
    await expect(generateSql(model, 'data', 3)).rejects.toThrow('Referencia inexistente');
  });
});
