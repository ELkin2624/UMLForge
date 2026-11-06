import type { UMLModel } from '../../../types/canonical-model';
import type { UMLCommand } from '../../uml-commands';
import type { AIPatch } from '../types';

export type PatchTranslation = { ok: true; commands: UMLCommand[] } | { ok: false; message: string };

const byName = (name: unknown) => String(name ?? '').trim().toLowerCase();

/**
 * Traduce un parche de la IA (que referencia elementos por NOMBRE) a comandos del motor
 * (que usan IDs). Es pura: los ids nuevos los aporta `newId`.
 * El commandId deriva del patch_id, así que aprobar dos veces el mismo parche no duplica nada.
 */
export function patchToCommands(
  model: UMLModel,
  patch: AIPatch,
  newId: () => string,
): PatchTranslation {
  const commandId = `patch:${patch.patch_id}`;

  switch (patch.operation) {
    case 'ADD_CLASS': {
      if (model.classes.some((c) => byName(c.name) === byName(patch.target))) {
        return { ok: true, commands: [] }; // ya existe: nada que hacer
      }
      const seen = new Set<string>();
      const attributes = (patch.data?.attributes ?? [])
        .map((att: string | { name?: string; type?: string }) => ({
          id: newId(),
          name: (typeof att === 'string' ? att : att.name ?? '').trim(),
          type: (typeof att === 'string' ? 'String' : att.type) || 'String',
          visibility: 'private' as const,
        }))
        .filter((a: { name: string }) => {
          const key = a.name.toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      const operations = (patch.data?.operations ?? []).map(
        (op: string | { name?: string; return_type?: string }) => ({
          id: newId(),
          name: typeof op === 'string' ? op : op.name ?? '',
          return_type: (typeof op === 'string' ? 'void' : op.return_type) || 'void',
          visibility: 'public' as const,
          parameters: [],
        }),
      );
      return {
        ok: true,
        commands: [{ type: 'addClass', commandId, id: newId(), name: patch.target, attributes, operations }],
      };
    }

    case 'ADD_RELATION': {
      const source = model.classes.find((c) => byName(c.name) === byName(patch.data?.source));
      const target = model.classes.find((c) => byName(c.name) === byName(patch.data?.target));
      if (!source || !target) {
        return {
          ok: false,
          message: `No se encontró la clase "${!source ? patch.data?.source : patch.data?.target}" para crear la relación.`,
        };
      }
      return {
        ok: true,
        commands: [
          {
            type: 'addRelationship',
            commandId,
            relationship: {
              id: newId(),
              source_id: source.id,
              target_id: target.id,
              type: patch.data?.type || 'realization',
              source_multiplicity: '1',
              target_multiplicity: '1',
            },
          },
        ],
      };
    }

    case 'DELETE_CLASS': {
      const cls = model.classes.find((c) => byName(c.name) === byName(patch.target));
      return { ok: true, commands: cls ? [{ type: 'deleteClass', commandId, id: cls.id }] : [] };
    }

    default:
      return { ok: false, message: `La operación ${patch.operation} aún no se puede aplicar.` };
  }
}
