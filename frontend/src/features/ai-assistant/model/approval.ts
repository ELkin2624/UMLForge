import type { UMLModel } from '../../../types/canonical-model';
import {
  applyCommands,
  fingerprintElement,
  type CommandErrorCode,
  type UMLCommand,
} from '../../uml-commands';
import type { AIPatch } from '../types';
import { patchToCommands } from './patch-to-commands';

export type BatchResult =
  | {
      ok: true;
      model: UMLModel;
      /** Comandos aplicados, en orden (para rehacer). */
      forward: UMLCommand[];
      /** Comandos que deshacen TODO el lote, en orden de aplicación. */
      inverse: UMLCommand[];
      touched: string[];
      /** Parches que se aplicaron (incluye los que ya estaban hechos y no cambiaron nada). */
      patchIds: string[];
    }
  | {
      ok: false;
      code: CommandErrorCode | 'STALE';
      message: string;
      /** Parche que causó el fallo. */
      patchId: string;
      /** Todos los parches obsoletos detectados (solo con code 'STALE'). */
      staleIds: string[];
    };

/** Ids de los elementos cuya huella ya no coincide con la capturada al recibir el parche. */
export function changedSinceProposal(model: UMLModel, patch: Pick<AIPatch, 'base'>): string[] {
  return Object.entries(patch.base ?? {})
    .filter(([id, fingerprint]) => fingerprintElement(model, id) !== fingerprint)
    .map(([id]) => id);
}

/**
 * Aplica uno o varios parches como un lote ATÓMICO sobre `model` (el estado más reciente).
 * - Antes de tocar nada comprueba que ningún parche esté obsoleto (otra persona cambió lo que
 *   iba a modificar): en ese caso devuelve STALE con TODOS los obsoletos y no aplica ninguno.
 * - Si algún parche no se puede traducir o aplicar, no se aplica ninguno.
 * Las huellas se comprueban contra el modelo ORIGINAL, no contra el que va resultando del lote:
 * así dos parches del mismo lote pueden tocar la misma clase.
 */
export function approveBatch(model: UMLModel, patches: AIPatch[], newId: () => string): BatchResult {
  const stale = patches.filter((p) => changedSinceProposal(model, p).length > 0);
  if (stale.length > 0) {
    const first = stale[0];
    return {
      ok: false,
      code: 'STALE',
      patchId: first.patch_id,
      staleIds: stale.map((p) => p.patch_id),
      message:
        stale.length === 1
          ? `La sugerencia sobre "${first.target || first.data?.source}" quedó obsoleta: otra persona modificó ese elemento. Pide al agente que la proponga de nuevo.`
          : `${stale.length} sugerencias quedaron obsoletas porque otras personas modificaron esos elementos.`,
    };
  }

  let current = model;
  const forward: UMLCommand[] = [];
  const inverse: UMLCommand[] = [];
  const touched = new Set<string>();

  for (const patch of patches) {
    const translation = patchToCommands(current, { ...patch, base: undefined }, newId);
    if (!translation.ok) {
      return { ok: false, code: 'INVALID', message: translation.message, patchId: patch.patch_id, staleIds: [] };
    }
    const result = applyCommands(current, translation.commands);
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message, patchId: patch.patch_id, staleIds: [] };
    }
    current = result.model;
    forward.push(...translation.commands);
    inverse.unshift(...result.inverse);
    result.touched.forEach((id) => touched.add(id));
  }

  return {
    ok: true,
    model: current,
    forward,
    inverse,
    touched: [...touched],
    patchIds: patches.map((p) => p.patch_id),
  };
}
