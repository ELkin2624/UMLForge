import type { UMLAttribute, UMLClass, UMLModel } from '../../../types/canonical-model';
import { snapshotFingerprints, type ExpectedFingerprints, type UMLCommand } from '../../uml-commands';
import type { AIPatch } from '../types';

export type PatchTranslation = { ok: true; commands: UMLCommand[] } | { ok: false; message: string };

type AttributeInput = string | { name?: string; type?: string; visibility?: UMLAttribute['visibility'] };
type AttributeUpdate = { name?: string; new_name?: string; type?: string; visibility?: UMLAttribute['visibility'] };

const byName = (name: unknown) => String(name ?? '').trim().toLowerCase();
const findClass = (model: UMLModel, name: unknown): UMLClass | undefined =>
  model.classes.find((c) => byName(c.name) === byName(name));

/**
 * Huellas de los elementos EXISTENTES que el parche va a modificar o borrar.
 * Debe llamarse cuando la sugerencia LLEGA (no al aprobarla): así, si otra persona toca esos
 * elementos entretanto, al aprobar el motor detecta el CONFLICT en vez de pisar su cambio.
 * Las altas (ADD_*) no necesitan huella.
 */
export function captureBase(model: UMLModel, patch: Pick<AIPatch, 'operation' | 'target' | 'data'>): ExpectedFingerprints {
  switch (patch.operation) {
    case 'UPDATE_CLASS':
    case 'DELETE_CLASS': {
      const cls = findClass(model, patch.target);
      return cls ? snapshotFingerprints(model, [cls.id]) : {};
    }
    case 'DELETE_RELATION': {
      const matches = findRelations(model, patch.data);
      return matches.length === 1 ? snapshotFingerprints(model, [matches[0].id]) : {};
    }
    default:
      return {};
  }
}

function findRelations(model: UMLModel, data: AIPatch['data'] | undefined) {
  const source = findClass(model, data?.source);
  const target = findClass(model, data?.target);
  if (!source || !target) return [];
  return model.relationships.filter(
    (r) =>
      r.source_id === source.id &&
      r.target_id === target.id &&
      (!data?.type || r.type === data.type),
  );
}

/**
 * Traduce un parche de la IA (que referencia elementos por NOMBRE) a comandos del motor
 * (que usan IDs). Es pura: los ids nuevos los aporta `newId`.
 * El commandId deriva del patch_id, así que aprobar dos veces el mismo parche no duplica nada.
 * Si el parche trae `base` (huellas capturadas al recibirlo), se adjunta como `expected` al
 * PRIMER comando: el motor rechaza todo el lote si el elemento cambió desde entonces.
 *
 * Contrato de `data` por operación (el mismo que describe el backend a la IA):
 * - ADD_CLASS:       { attributes?: [string | {name,type,visibility}], operations?: [...] }
 * - UPDATE_CLASS:    { new_name?, add_attributes?, update_attributes?: [{name,new_name?,type?,visibility?}],
 *                      remove_attributes?: [nombre] }
 * - DELETE_CLASS:    {}
 * - ADD_RELATION:    { source, target, type?, source_multiplicity?, target_multiplicity? }
 * - DELETE_RELATION: { source, target, type? }
 */
export function patchToCommands(
  model: UMLModel,
  patch: AIPatch,
  newId: () => string,
): PatchTranslation {
  const baseId = `patch:${patch.patch_id}`;
  // Un solo comando conserva el commandId simple; varios llevan sufijo para ser únicos.
  const finish = (commands: UMLCommand[]): PatchTranslation => {
    const out = commands.map((c, i) => ({ ...c, commandId: commands.length > 1 ? `${baseId}:${i}` : baseId }));
    if (out.length > 0 && patch.base && Object.keys(patch.base).length > 0) {
      out[0] = { ...out[0], expected: patch.base };
    }
    return { ok: true, commands: out };
  };
  const placeholder = baseId; // finish() asigna los commandId definitivos

  switch (patch.operation) {
    case 'ADD_CLASS': {
      if (findClass(model, patch.target)) return { ok: true, commands: [] }; // ya existe: nada que hacer
      const seen = new Set<string>();
      const attributes = ((patch.data?.attributes ?? []) as AttributeInput[])
        .map((att) => ({
          id: newId(),
          name: (typeof att === 'string' ? att : att.name ?? '').trim(),
          type: (typeof att === 'string' ? 'String' : att.type) || 'String',
          visibility: (typeof att === 'string' ? undefined : att.visibility) ?? ('private' as const),
        }))
        .filter((a) => {
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
      return finish([
        { type: 'addClass', commandId: placeholder, id: newId(), name: patch.target, attributes, operations },
      ]);
    }

    case 'UPDATE_CLASS': {
      const cls = findClass(model, patch.target);
      if (!cls) return { ok: false, message: `No se encontró la clase "${patch.target}" para modificarla.` };
      const data = patch.data ?? {};
      const commands: UMLCommand[] = [];
      const findAttr = (name: unknown) => cls.attributes.find((a) => byName(a.name) === byName(name));

      if (data.new_name && byName(data.new_name) !== byName(cls.name)) {
        commands.push({ type: 'renameClass', commandId: placeholder, id: cls.id, name: String(data.new_name) });
      }
      for (const name of (data.remove_attributes ?? []) as string[]) {
        const attr = findAttr(name);
        if (!attr) return { ok: false, message: `La clase "${cls.name}" no tiene el atributo "${name}".` };
        commands.push({ type: 'deleteAttribute', commandId: placeholder, classId: cls.id, attributeId: attr.id });
      }
      for (const upd of (data.update_attributes ?? []) as AttributeUpdate[]) {
        const attr = findAttr(upd.name);
        if (!attr) return { ok: false, message: `La clase "${cls.name}" no tiene el atributo "${upd.name}".` };
        const changes: Partial<Omit<UMLAttribute, 'id'>> = {};
        if (upd.new_name) changes.name = upd.new_name;
        if (upd.type) changes.type = upd.type;
        if (upd.visibility) changes.visibility = upd.visibility;
        if (Object.keys(changes).length > 0) {
          commands.push({ type: 'updateAttribute', commandId: placeholder, classId: cls.id, attributeId: attr.id, changes });
        }
      }
      for (const att of (data.add_attributes ?? []) as AttributeInput[]) {
        const name = (typeof att === 'string' ? att : att.name ?? '').trim();
        if (!name || findAttr(name)) continue; // ya existe: idempotente
        commands.push({
          type: 'addAttribute',
          commandId: placeholder,
          classId: cls.id,
          attribute: {
            id: newId(),
            name,
            type: (typeof att === 'string' ? 'String' : att.type) || 'String',
            visibility: (typeof att === 'string' ? undefined : att.visibility) ?? 'private',
          },
        });
      }
      return finish(commands);
    }

    case 'DELETE_CLASS': {
      const cls = findClass(model, patch.target);
      return finish(cls ? [{ type: 'deleteClass', commandId: placeholder, id: cls.id }] : []);
    }

    case 'ADD_RELATION': {
      const source = findClass(model, patch.data?.source);
      const target = findClass(model, patch.data?.target);
      if (!source || !target) {
        return {
          ok: false,
          message: `No se encontró la clase "${!source ? patch.data?.source : patch.data?.target}" para crear la relación.`,
        };
      }
      const type = patch.data?.type || 'realization';
      const exists = model.relationships.some(
        (r) => r.source_id === source.id && r.target_id === target.id && r.type === type,
      );
      if (exists) return { ok: true, commands: [] }; // ya existe: idempotente
      return finish([
        {
          type: 'addRelationship',
          commandId: placeholder,
          relationship: {
            id: newId(),
            source_id: source.id,
            target_id: target.id,
            type,
            source_multiplicity: patch.data?.source_multiplicity || '1',
            target_multiplicity: patch.data?.target_multiplicity || '1',
          },
        },
      ]);
    }

    case 'DELETE_RELATION': {
      const matches = findRelations(model, patch.data);
      if (matches.length === 0) return { ok: true, commands: [] }; // ya no existe
      if (matches.length > 1) {
        return {
          ok: false,
          message: `Hay ${matches.length} relaciones entre "${patch.data?.source}" y "${patch.data?.target}"; indica el tipo para saber cuál borrar.`,
        };
      }
      return finish([{ type: 'deleteRelationship', commandId: placeholder, id: matches[0].id }]);
    }

    default:
      return { ok: false, message: `La operación ${(patch as AIPatch).operation} no se puede aplicar.` };
  }
}
