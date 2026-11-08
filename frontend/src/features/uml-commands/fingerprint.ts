import type { UMLModel } from '../../types/canonical-model';
import type { ExpectedFingerprints } from './types';

/** Huella que significa "este elemento no debe existir". */
export const ABSENT = 'absent';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FNV-1a de 32 bits: suficiente para detectar cambios (no es criptográfico). */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function findElement(model: UMLModel, id: string): unknown {
  return (
    model.classes.find((c) => c.id === id) ??
    model.relationships.find((r) => r.id === id)
  );
}

/** Huella del elemento (clase o relación) con ese id, o ABSENT si no existe. */
export function fingerprintElement(model: UMLModel, id: string): string {
  const element = findElement(model, id);
  return element === undefined ? ABSENT : fnv1a(stableStringify(element));
}

/** Foto de huellas de varios elementos, para adjuntarla a un comando como `expected`. */
export function snapshotFingerprints(model: UMLModel, ids: string[]): ExpectedFingerprints {
  const result: ExpectedFingerprints = {};
  for (const id of ids) result[id] = fingerprintElement(model, id);
  return result;
}
