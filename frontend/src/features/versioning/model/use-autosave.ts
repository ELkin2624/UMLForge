import { useEffect } from 'react';
import { useModelStore, isApplyingRemoteModel } from '../../../store/model-store';
import { useShareStore } from '../../sharing/model/share-store';
import { canEdit } from '../../sharing/model/capabilities';
import { saveDiagram } from '../../../api/diagrams-api';
import { consumeSaveSource, markAiChange } from './save-source';
import { useVersioningStore } from './versioning-store';
import { registerFlushHandler } from './flush';

export const AUTOSAVE_DEBOUNCE_MS = 3000;
export const AUTOSAVE_RETRY_MS = 10000;

/**
 * Autoguarda el diagrama en el backend (MongoDB) 3 s después del último cambio
 * LOCAL. Los cambios recibidos de otros usuarios (Yjs) no disparan guardado: así
 * cada versión queda atribuida a quien hizo el cambio. El backend descarta los
 * guardados sin diferencias, de modo que nunca se duplican versiones.
 *
 * Solo actúa si hay un diagrama activo y el rol permite editar.
 */
export function useAutosave(): void {
  const roomId = useShareStore((s) => s.roomId);
  const localRole = useShareStore((s) => s.localRole);

  useEffect(() => {
    if (!roomId || !canEdit(localRole)) return;

    const { setSaveState, markSaved } = useVersioningStore.getState();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let dirty = false;
    let lastSavedJson: string | null = null;
    let disposed = false;

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delay);
    };

    async function flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (inFlight) {
        dirty = true;
        return;
      }
      const model = useModelStore.getState().model;
      if (!model) return;

      const json = JSON.stringify(model);
      if (json === lastSavedJson) {
        dirty = false;
        return;
      }

      inFlight = true;
      dirty = false;
      setSaveState('saving');
      const source = consumeSaveSource();
      try {
        const res = await saveDiagram(roomId as string, model, source);
        lastSavedJson = json;
        markSaved(Boolean(res.version_created));
      } catch (e) {
        // No perder la atribución a la IA si el guardado falló.
        if (source === 'ai') markAiChange();
        setSaveState('error', e instanceof Error ? e.message : 'No se pudo guardar');
        dirty = true;
        if (!disposed) schedule(AUTOSAVE_RETRY_MS);
      } finally {
        inFlight = false;
        if (dirty && !disposed && !timer) schedule(AUTOSAVE_DEBOUNCE_MS);
      }
    }

    // Guardar ya y esperar a que termine (también si ya había un guardado en curso).
    const flushAndWait = async (): Promise<void> => {
      await flush();
      while (inFlight) await new Promise((resolve) => setTimeout(resolve, 50));
      if (dirty) await flush();
    };
    registerFlushHandler(flushAndWait);

    const unsubscribe = useModelStore.subscribe(
      (state) => state.model,
      (model) => {
        if (!model || isApplyingRemoteModel()) return;
        dirty = true;
        schedule(AUTOSAVE_DEBOUNCE_MS);
      }
    );

    const onBeforeUnload = () => {
      if (dirty) void flush();
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      disposed = true;
      registerFlushHandler(null);
      unsubscribe();
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (timer) clearTimeout(timer);
      // Cambio de diagrama o de rol: no perder lo pendiente.
      if (dirty) void flush();
    };
  }, [roomId, localRole]);
}
