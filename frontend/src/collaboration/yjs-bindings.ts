import * as Y from 'yjs';
import { useModelStore } from '../store/model-store';
import { getModelMap, setModelJson } from './yjs-document';
import type { UMLModel } from '../types/canonical-model';

/**
 * Origen usado en transacciones locales para distinguirlas de cambios remotos.
 * Permite que el observer de Yjs filtre actualizaciones propias y evite bucles.
 */
export const LOCAL_ORIGIN = 'umlforge-local';

/**
 * Enlaza un Y.Doc con el model-store de Zustand de forma bidireccional.
 *
 * Flujo LOCAL:  store.model cambia → Y.Doc actualizado (origen LOCAL_ORIGIN)
 * Flujo REMOTO: Y.Doc cambia (origen != LOCAL_ORIGIN) → store.setModel()
 *
 * SUSCRIPCIÓN ESTRICTA: solo observa el campo `model` del store mediante
 * selector explícito. NUNCA suscribe el estado completo ni otros campos
 * (e2eResult, validationResult, collaboration, etc.).
 *
 * Retorna una función `unbind` que cancela ambas suscripciones.
 * Debe llamarse antes de destruir el doc o desconectar el provider.
 */
export function bindYjsToStore(doc: Y.Doc): () => void {
  const yMap = getModelMap(doc);

  // ── 1. Store → Y.Doc ──────────────────────────────────────────────────────
  // Suscripción estricta: solo el campo `model`, no el store completo.
  let isApplyingRemote = false;

  const unsubscribeStore = useModelStore.subscribe(
    (state) => state.model,
    (model) => {
      // Si estamos aplicando un cambio remoto, no re-publicar en Yjs (evitar loop)
      if (isApplyingRemote) return;
      if (model === null) return;

      const json = JSON.stringify(model);
      // Verificar que el contenido realmente cambió antes de escribir
      const current = yMap.get('model');
      if (current === json) return;

      setModelJson(doc, json, LOCAL_ORIGIN);
    }
  );

  // ── 2. Y.Doc → Store ──────────────────────────────────────────────────────
  const onYMapChange = (
    _event: Y.YMapEvent<string>,
    transaction: Y.Transaction
  ) => {
    // Solo procesar cambios con origen remoto (no local)
    if (transaction.origin === LOCAL_ORIGIN) return;

    const json = yMap.get('model');
    if (!json) return;

    try {
      const model = JSON.parse(json) as UMLModel;
      isApplyingRemote = true;
      useModelStore.getState().setModel(model);
    } catch {
      console.warn('[UMLForge Collaboration] JSON inválido recibido desde Y.Doc:', json);
    } finally {
      isApplyingRemote = false;
    }
  };

  yMap.observe(onYMapChange);

  // ── Unbind ────────────────────────────────────────────────────────────────
  return function unbind() {
    unsubscribeStore();
    yMap.unobserve(onYMapChange);
  };
}
