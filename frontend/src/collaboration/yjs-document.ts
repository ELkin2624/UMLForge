import * as Y from 'yjs';

/** Clave del mapa raíz donde se almacena el modelo JSON. */
const MODEL_KEY = 'model';

/**
 * Crea un nuevo Y.Doc con el Y.Map raíz para el modelo UML.
 * El documento NO se conecta a ningún proveedor aquí; eso es responsabilidad del manager.
 */
export function createYjsDocument(): Y.Doc {
  return new Y.Doc();
}

/**
 * Obtiene el Y.Map raíz que contiene el modelo.
 * Siempre retorna la misma instancia para el mismo doc (idempotente).
 */
export function getModelMap(doc: Y.Doc): Y.Map<string> {
  return doc.getMap<string>('umlforge');
}

/**
 * Lee el JSON string del modelo desde el Y.Doc.
 * Retorna undefined si el doc no contiene modelo aún.
 */
export function getModelJson(doc: Y.Doc): string | undefined {
  return getModelMap(doc).get(MODEL_KEY);
}

/**
 * Escribe el JSON string del modelo en el Y.Doc, dentro de una transacción
 * con el origen especificado.
 *
 * Usar origin='umlforge-local' para cambios iniciados localmente,
 * de modo que el observer de Yjs pueda filtrarlos y evitar bucles.
 */
export function setModelJson(doc: Y.Doc, json: string, origin: string): void {
  doc.transact(() => {
    getModelMap(doc).set(MODEL_KEY, json);
  }, origin);
}

/**
 * Obtiene el Y.Map que almacena las posiciones visuales de los nodos.
 * Estructura: nodeId -> { x, y }
 */
export function getVisualStateMap(doc: Y.Doc): Y.Map<{ x: number; y: number }> {
  return doc.getMap<{ x: number; y: number }>('visual-state');
}

/**
 * Obtiene un snapshot del estado visual actual como un registro (record).
 */
export function getVisualStateRecord(doc: Y.Doc): Record<string, { x: number; y: number }> {
  return getVisualStateMap(doc).toJSON();
}

/**
 * Actualiza la posición de un nodo en el estado visual.
 */
export function updateVisualStateNode(doc: Y.Doc, nodeId: string, position: { x: number; y: number }, origin: string): void {
  doc.transact(() => {
    getVisualStateMap(doc).set(nodeId, position);
  }, origin);
}

/**
 * Elimina la posición de un nodo en el estado visual.
 */
export function removeVisualStateNode(doc: Y.Doc, nodeId: string, origin: string): void {
  doc.transact(() => {
    getVisualStateMap(doc).delete(nodeId);
  }, origin);
}
