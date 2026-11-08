import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPendingSave, registerFlushHandler } from './flush';

describe('flushPendingSave', () => {
  afterEach(() => {
    registerFlushHandler(null);
    vi.useRealTimers();
  });

  it('sin autoguardado activo no hace nada', async () => {
    await expect(flushPendingSave()).resolves.toBeUndefined();
  });

  it('espera a que termine el guardado', async () => {
    const order: string[] = [];
    registerFlushHandler(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push('guardado');
    });
    await flushPendingSave();
    order.push('despues');
    expect(order).toEqual(['guardado', 'despues']);
  });

  it('si el guardado falla, no lanza (la consulta sigue con lo guardado)', async () => {
    registerFlushHandler(async () => {
      throw new Error('sin red');
    });
    await expect(flushPendingSave()).resolves.toBeUndefined();
  });

  it('no espera indefinidamente: respeta el tiempo máximo', async () => {
    vi.useFakeTimers();
    registerFlushHandler(() => new Promise<void>(() => {})); // nunca termina
    const done = flushPendingSave(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(done).resolves.toBeUndefined();
  });
});
