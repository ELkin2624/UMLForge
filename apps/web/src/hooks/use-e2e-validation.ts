import { useCallback } from 'react';
import { useModelStore } from '../store/model-store';
import { validateE2E } from '../api/models-api';

export function useE2EValidation() {
  const {
    model,
    e2eState,
    e2eResult,
    e2eError,
    e2eStartedAt,
    e2eCompletedAt,
    setE2EState,
    setE2EResult,
    setE2EError,
    setE2EStartedAt,
    setE2ECompletedAt,
    resetE2E,
  } = useModelStore();

  const runE2EValidation = useCallback(async () => {
    if (!model) {
      setE2EError('No hay modelo para validar');
      setE2EState('failure');
      return;
    }

    setE2EError(null);
    setE2EResult(null);
    setE2EStartedAt(Date.now());
    setE2ECompletedAt(null);
    setE2EState('running');

    try {
      const result = await validateE2E(model);
      setE2EResult(result);
      setE2EState(result.success ? 'success' : 'failure');
      setE2ECompletedAt(Date.now());
    } catch (err: unknown) {
      let message = 'Error desconocido';
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      }

      // Diferenciar error de red
      if (
        message.includes('Failed to fetch') ||
        message.includes('NetworkError') ||
        message.includes('Network request failed') ||
        message.includes('ECONNREFUSED')
      ) {
        setE2EError('No se pudo conectar con el servidor');
      } else {
        setE2EError(message);
      }

      setE2EState('failure');
      setE2ECompletedAt(Date.now());
    }
  }, [
    model,
    setE2EError,
    setE2EResult,
    setE2EStartedAt,
    setE2ECompletedAt,
    setE2EState,
  ]);

  return {
    e2eState,
    e2eResult,
    e2eError,
    e2eStartedAt,
    e2eCompletedAt,
    runE2EValidation,
    resetE2E,
  };
}
