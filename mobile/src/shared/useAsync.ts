/* eslint-disable react-hooks/use-memo, react-hooks/exhaustive-deps -- las dependencias las define el llamador a propósito */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Carga un recurso al montar (y cuando cambian `deps`). Ignora respuestas de cargas obsoletas. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  const reload = useCallback(async () => {
    const id = ++run.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (id === run.current) setData(result);
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
