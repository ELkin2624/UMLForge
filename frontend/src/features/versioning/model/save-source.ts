import type { SaveSource } from '../../../api/diagrams-api';

/**
 * Origen del próximo autoguardado. Por defecto "user"; la IA lo marca como "ai"
 * justo antes de aplicar sus parches para que la versión se atribuya a la IA.
 */
let nextSource: SaveSource = 'user';

/** Marca el próximo guardado como originado por la IA. */
export function markAiChange(): void {
  nextSource = 'ai';
}

/** Devuelve el origen pendiente y lo restablece a "user". */
export function consumeSaveSource(): SaveSource {
  const source = nextSource;
  nextSource = 'user';
  return source;
}
