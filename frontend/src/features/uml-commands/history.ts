import type { UMLModel } from '../../types/canonical-model';
import { applyCommands } from './engine';
import { snapshotFingerprints } from './fingerprint';
import type { ExpectedFingerprints, UMLCommand } from './types';

/**
 * Historial de deshacer/rehacer sobre el motor de comandos (funciones puras).
 *
 * Reglas:
 * - Solo se deshace lo que se registró aquí (lo aplicado mediante comandos): nunca cambios ajenos.
 * - Antes de deshacer/rehacer se comprueba que los elementos afectados sigan EXACTAMENTE como
 *   los dejó la entrada; si otra persona los tocó, se rechaza con CONFLICT y no se pierde nada.
 */

export type HistoryAuthor = 'user' | 'ai';

export interface HistoryEntry {
  id: string;
  label: string;
  author: HistoryAuthor;
  /** Comandos tal como se aplicaron (para rehacer). */
  forward: UMLCommand[];
  /** Comandos que lo deshacen, ya en orden de aplicación. */
  inverse: UMLCommand[];
  touched: string[];
  /** Huellas de `touched` justo después de aplicar la entrada (precondición de deshacer). */
  afterApply: ExpectedFingerprints;
  /** Huellas justo después de deshacerla (precondición de rehacer). Solo en la pila de rehacer. */
  afterUndo?: ExpectedFingerprints;
}

export interface HistoryState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
}

export const MAX_HISTORY = 50;
export const emptyHistory = (): HistoryState => ({ undoStack: [], redoStack: [] });

export type HistoryResult =
  | { ok: true; model: UMLModel; state: HistoryState; entry: HistoryEntry }
  | { ok: false; code: 'EMPTY' | 'CONFLICT' | 'INVALID'; message: string };

/** Registra un cambio ya aplicado (`modelAfter` es el modelo resultante). Vacía el rehacer. */
export function recordEntry(
  state: HistoryState,
  entry: Omit<HistoryEntry, 'afterApply' | 'afterUndo'>,
  modelAfter: UMLModel,
): HistoryState {
  if (entry.inverse.length === 0) return state; // no hubo cambio real
  const full: HistoryEntry = { ...entry, afterApply: snapshotFingerprints(modelAfter, entry.touched) };
  return { undoStack: [...state.undoStack, full].slice(-MAX_HISTORY), redoStack: [] };
}

function untouched(model: UMLModel, expected: ExpectedFingerprints): boolean {
  const now = snapshotFingerprints(model, Object.keys(expected));
  return Object.entries(expected).every(([id, hash]) => now[id] === hash);
}

export function undo(state: HistoryState, model: UMLModel): HistoryResult {
  const entry = state.undoStack.at(-1);
  if (!entry) return { ok: false, code: 'EMPTY', message: 'No hay nada que deshacer.' };
  if (!untouched(model, entry.afterApply)) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: `No se puede deshacer "${entry.label}": otra persona modificó esos elementos.`,
    };
  }
  const result = applyCommands(model, entry.inverse);
  if (!result.ok) return { ok: false, code: 'INVALID', message: result.message };
  const redoEntry: HistoryEntry = { ...entry, afterUndo: snapshotFingerprints(result.model, entry.touched) };
  return {
    ok: true,
    model: result.model,
    entry,
    state: { undoStack: state.undoStack.slice(0, -1), redoStack: [...state.redoStack, redoEntry] },
  };
}

export function redo(state: HistoryState, model: UMLModel): HistoryResult {
  const entry = state.redoStack.at(-1);
  if (!entry) return { ok: false, code: 'EMPTY', message: 'No hay nada que rehacer.' };
  if (entry.afterUndo && !untouched(model, entry.afterUndo)) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: `No se puede rehacer "${entry.label}": otra persona modificó esos elementos.`,
    };
  }
  const result = applyCommands(model, entry.forward);
  if (!result.ok) return { ok: false, code: 'INVALID', message: result.message };
  const undoEntry: HistoryEntry = {
    ...entry,
    inverse: result.inverse,
    afterApply: snapshotFingerprints(result.model, entry.touched),
    afterUndo: undefined,
  };
  return {
    ok: true,
    model: result.model,
    entry,
    state: { undoStack: [...state.undoStack, undoEntry], redoStack: state.redoStack.slice(0, -1) },
  };
}
