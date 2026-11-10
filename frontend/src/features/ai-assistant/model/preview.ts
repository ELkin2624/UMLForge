import type { UMLModel } from '../../../types/canonical-model';
import type { UMLCommand } from '../../uml-commands';
import type { AIPatch } from '../types';
import { patchToCommands } from './patch-to-commands';

export interface PreviewLine {
  kind: 'add' | 'change' | 'remove';
  text: string;
  /** Nivel de sangría (0 = elemento, 1 = detalle). */
  depth: 0 | 1;
}

export type PatchPreview =
  | { ok: true; lines: PreviewLine[] }
  | { ok: false; message: string };

/**
 * Describe QUÉ cambiaría un parche sin tocar el modelo (vista previa).
 * Usa la misma traducción que la aprobación, así que lo que se muestra es lo que se ejecutará.
 */
export function previewPatch(model: UMLModel, patch: AIPatch): PatchPreview {
  let counter = 0;
  const translation = patchToCommands(model, { ...patch, base: undefined }, () => `preview-${++counter}`);
  if (!translation.ok) return { ok: false, message: translation.message };
  if (translation.commands.length === 0) {
    return { ok: true, lines: [{ kind: 'change', text: 'Sin cambios: ya está aplicado.', depth: 0 }] };
  }

  const className = (id: string) => model.classes.find((c) => c.id === id)?.name ?? id;
  const lines: PreviewLine[] = [];

  for (const cmd of translation.commands as UMLCommand[]) {
    switch (cmd.type) {
      case 'addClass':
        lines.push({ kind: 'add', text: `Clase ${cmd.name}`, depth: 0 });
        (cmd.attributes ?? []).forEach((a) => lines.push({ kind: 'add', text: `${a.name}: ${a.type}`, depth: 1 }));
        (cmd.operations ?? []).forEach((o) => lines.push({ kind: 'add', text: `${o.name}()`, depth: 1 }));
        break;
      case 'renameClass':
        lines.push({ kind: 'change', text: `Renombrar ${className(cmd.id)} → ${cmd.name}`, depth: 0 });
        break;
      case 'deleteClass': {
        const related = model.relationships.filter((r) => r.source_id === cmd.id || r.target_id === cmd.id).length;
        lines.push({ kind: 'remove', text: `Eliminar clase ${className(cmd.id)}`, depth: 0 });
        if (related > 0) lines.push({ kind: 'remove', text: `y ${related} relación(es) asociada(s)`, depth: 1 });
        break;
      }
      case 'addAttribute':
        lines.push({
          kind: 'add',
          text: `${className(cmd.classId)}: + ${cmd.attribute.name}: ${cmd.attribute.type}`,
          depth: 0,
        });
        break;
      case 'updateAttribute': {
        const attr = model.classes.find((c) => c.id === cmd.classId)?.attributes.find((a) => a.id === cmd.attributeId);
        const changes = Object.entries(cmd.changes)
          .map(([k, v]) => `${k}: ${String((attr as unknown as Record<string, unknown>)?.[k] ?? '∅')} → ${String(v)}`)
          .join(', ');
        lines.push({ kind: 'change', text: `${className(cmd.classId)}.${attr?.name ?? cmd.attributeId}: ${changes}`, depth: 0 });
        break;
      }
      case 'deleteAttribute': {
        const attr = model.classes.find((c) => c.id === cmd.classId)?.attributes.find((a) => a.id === cmd.attributeId);
        lines.push({ kind: 'remove', text: `${className(cmd.classId)}: − ${attr?.name ?? cmd.attributeId}`, depth: 0 });
        break;
      }
      case 'addRelationship': {
        const r = cmd.relationship;
        lines.push({
          kind: 'add',
          text: `${className(r.source_id)} —${r.type}→ ${className(r.target_id)}`,
          depth: 0,
        });
        break;
      }
      case 'updateRelationship':
        lines.push({ kind: 'change', text: `Modificar relación ${cmd.id}`, depth: 0 });
        break;
      case 'deleteRelationship': {
        const r = model.relationships.find((x) => x.id === cmd.id);
        lines.push({
          kind: 'remove',
          text: r
            ? `Eliminar relación ${className(r.source_id)} —${r.type}→ ${className(r.target_id)}`
            : `Eliminar relación ${cmd.id}`,
          depth: 0,
        });
        break;
      }
    }
  }
  return { ok: true, lines };
}
