import type { UMLClass, UMLModel, UMLRelationship } from '../../types/canonical-model';
import { fingerprintElement } from './fingerprint';
import type {
  CommandContext,
  CommandError,
  CommandErrorCode,
  CommandResult,
  UMLCommand,
} from './types';

/**
 * Motor de comandos UML: ÚNICA vía para modificar el modelo (humanos e IA).
 * Funciones puras: nunca mutan el modelo recibido; devuelven uno nuevo.
 */

const VISIBILITIES = ['public', 'private', 'protected', 'package'];
const RELATIONSHIP_TYPES = [
  'association',
  'generalization',
  'dependency',
  'realization',
  'interface_realization',
  'composition',
  'aggregation',
];

class CommandFailure extends Error {
  readonly code: CommandErrorCode;
  constructor(code: CommandErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const fail = (code: CommandErrorCode, message: string): never => {
  throw new CommandFailure(code, message);
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function requireName(name: unknown, what: string): string {
  if (typeof name !== 'string' || !name.trim()) fail('INVALID', `${what} necesita un nombre.`);
  return (name as string).trim();
}

function requireClass(model: UMLModel, id: string): UMLClass {
  return model.classes.find((c) => c.id === id) ?? fail('NOT_FOUND', `No existe la clase "${id}".`);
}

function checkVisibility(visibility: unknown): void {
  if (visibility !== undefined && !VISIBILITIES.includes(visibility as string)) {
    fail('INVALID', `Visibilidad no válida: "${String(visibility)}".`);
  }
}

function checkRelationship(model: UMLModel, rel: UMLRelationship): void {
  if (!RELATIONSHIP_TYPES.includes(rel.type)) {
    fail('INVALID', `Tipo de relación no válido: "${rel.type}".`);
  }
  requireClass(model, rel.source_id);
  requireClass(model, rel.target_id);
  for (const m of [rel.source_multiplicity, rel.target_multiplicity]) {
    if (m !== undefined && (typeof m !== 'string' || !m.trim())) {
      fail('INVALID', 'La multiplicidad no puede estar vacía.');
    }
  }
}

function checkExpected(model: UMLModel, cmd: UMLCommand): void {
  for (const [id, expected] of Object.entries(cmd.expected ?? {})) {
    if (fingerprintElement(model, id) !== expected) {
      fail('CONFLICT', `El elemento "${id}" cambió desde que se propuso el cambio.`);
    }
  }
}

interface Executed {
  inverse: UMLCommand[];
  touched: string[];
}

/** Aplica el comando sobre `model` (ya clonado). Lanza CommandFailure si no es válido. */
function execute(model: UMLModel, cmd: UMLCommand): Executed {
  const undoId = (n = 0) => `${cmd.commandId}:undo${n}`;

  switch (cmd.type) {
    case 'addClass': {
      const name = requireName(cmd.name, 'La clase');
      if (!cmd.id) fail('INVALID', 'La clase necesita un id.');
      if (findAnyId(model, cmd.id)) fail('ALREADY_EXISTS', `Ya existe un elemento con id "${cmd.id}".`);
      if (model.classes.some((c) => sameName(c.name, name))) {
        fail('DUPLICATE_NAME', `Ya existe una clase llamada "${name}".`);
      }
      const attributes = cmd.attributes ?? [];
      attributes.forEach((a) => {
        requireName(a.name, 'El atributo');
        checkVisibility(a.visibility);
      });
      if (new Set(attributes.map((a) => a.name.trim().toLowerCase())).size !== attributes.length) {
        fail('DUPLICATE_NAME', 'Hay atributos repetidos en la clase.');
      }
      const index = Math.min(Math.max(cmd.index ?? model.classes.length, 0), model.classes.length);
      model.classes.splice(index, 0, { id: cmd.id, name, attributes, operations: cmd.operations ?? [] });
      return { inverse: [{ type: 'deleteClass', commandId: undoId(), id: cmd.id }], touched: [cmd.id] };
    }

    case 'renameClass': {
      const cls = requireClass(model, cmd.id);
      const name = requireName(cmd.name, 'La clase');
      if (model.classes.some((c) => c.id !== cls.id && sameName(c.name, name))) {
        fail('DUPLICATE_NAME', `Ya existe una clase llamada "${name}".`);
      }
      const previous = cls.name;
      cls.name = name;
      return {
        inverse: [{ type: 'renameClass', commandId: undoId(), id: cmd.id, name: previous }],
        touched: [cmd.id],
      };
    }

    case 'deleteClass': {
      const cls = requireClass(model, cmd.id);
      const classIndex = model.classes.indexOf(cls);
      const removedRels = model.relationships
        .map((relationship, index) => ({ relationship, index }))
        .filter(({ relationship: r }) => r.source_id === cls.id || r.target_id === cls.id);
      model.classes = model.classes.filter((c) => c.id !== cls.id);
      model.relationships = model.relationships.filter((r) => !removedRels.some((x) => x.relationship === r));
      return {
        inverse: [
          {
            type: 'addClass',
            commandId: undoId(),
            id: cls.id,
            name: cls.name,
            attributes: cls.attributes,
            operations: cls.operations,
            index: classIndex,
          },
          ...removedRels.map<UMLCommand>(({ relationship, index }, i) => ({
            type: 'addRelationship',
            commandId: undoId(i + 1),
            relationship,
            index,
          })),
        ],
        touched: [cls.id, ...removedRels.map((x) => x.relationship.id)],
      };
    }

    case 'addAttribute': {
      const cls = requireClass(model, cmd.classId);
      const name = requireName(cmd.attribute?.name, 'El atributo');
      if (!cmd.attribute.id) fail('INVALID', 'El atributo necesita un id.');
      if (!cmd.attribute.type?.trim()) fail('INVALID', 'El atributo necesita un tipo.');
      checkVisibility(cmd.attribute.visibility);
      if (cls.attributes.some((a) => a.id === cmd.attribute.id)) {
        fail('ALREADY_EXISTS', `Ya existe el atributo con id "${cmd.attribute.id}".`);
      }
      if (cls.attributes.some((a) => sameName(a.name, name))) {
        fail('DUPLICATE_NAME', `La clase "${cls.name}" ya tiene un atributo "${name}".`);
      }
      const index = Math.min(Math.max(cmd.index ?? cls.attributes.length, 0), cls.attributes.length);
      cls.attributes.splice(index, 0, { ...cmd.attribute, name });
      return {
        inverse: [
          { type: 'deleteAttribute', commandId: undoId(), classId: cls.id, attributeId: cmd.attribute.id },
        ],
        touched: [cls.id],
      };
    }

    case 'updateAttribute': {
      const cls = requireClass(model, cmd.classId);
      const attr =
        cls.attributes.find((a) => a.id === cmd.attributeId) ??
        fail('NOT_FOUND', `No existe el atributo "${cmd.attributeId}".`);
      const changes = { ...(cmd.changes ?? {}) };
      if ('id' in changes) fail('INVALID', 'No se puede cambiar el id de un atributo.');
      if (changes.name !== undefined) {
        const name = requireName(changes.name, 'El atributo');
        if (cls.attributes.some((a) => a.id !== attr.id && sameName(a.name, name))) {
          fail('DUPLICATE_NAME', `La clase "${cls.name}" ya tiene un atributo "${name}".`);
        }
        changes.name = name;
      }
      if (changes.type !== undefined && !changes.type.trim()) fail('INVALID', 'El tipo no puede estar vacío.');
      checkVisibility(changes.visibility);
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(changes)) previous[key] = (attr as unknown as Record<string, unknown>)[key];
      Object.assign(attr, changes);
      return {
        inverse: [
          {
            type: 'updateAttribute',
            commandId: undoId(),
            classId: cls.id,
            attributeId: attr.id,
            changes: previous as typeof changes,
          },
        ],
        touched: [cls.id],
      };
    }

    case 'deleteAttribute': {
      const cls = requireClass(model, cmd.classId);
      const index = cls.attributes.findIndex((a) => a.id === cmd.attributeId);
      if (index < 0) fail('NOT_FOUND', `No existe el atributo "${cmd.attributeId}".`);
      const [removed] = cls.attributes.splice(index, 1);
      return {
        inverse: [{ type: 'addAttribute', commandId: undoId(), classId: cls.id, attribute: removed, index }],
        touched: [cls.id],
      };
    }

    case 'addRelationship': {
      const rel = cmd.relationship;
      if (!rel?.id) fail('INVALID', 'La relación necesita un id.');
      if (findAnyId(model, rel.id)) fail('ALREADY_EXISTS', `Ya existe un elemento con id "${rel.id}".`);
      checkRelationship(model, rel);
      const at = Math.min(Math.max(cmd.index ?? model.relationships.length, 0), model.relationships.length);
      model.relationships.splice(at, 0, { ...rel });
      return {
        inverse: [{ type: 'deleteRelationship', commandId: undoId(), id: rel.id }],
        touched: [rel.id],
      };
    }

    case 'updateRelationship': {
      const rel =
        model.relationships.find((r) => r.id === cmd.id) ??
        fail('NOT_FOUND', `No existe la relación "${cmd.id}".`);
      if ('id' in (cmd.changes ?? {})) fail('INVALID', 'No se puede cambiar el id de una relación.');
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(cmd.changes ?? {})) {
        previous[key] = (rel as unknown as Record<string, unknown>)[key];
      }
      const updated = { ...rel, ...cmd.changes };
      checkRelationship(model, updated);
      Object.assign(rel, updated);
      return {
        inverse: [
          {
            type: 'updateRelationship',
            commandId: undoId(),
            id: rel.id,
            changes: previous as unknown as Partial<UMLRelationship>,
          },
        ],
        touched: [rel.id],
      };
    }

    case 'deleteRelationship': {
      const index = model.relationships.findIndex((r) => r.id === cmd.id);
      if (index < 0) fail('NOT_FOUND', `No existe la relación "${cmd.id}".`);
      const [removed] = model.relationships.splice(index, 1);
      return {
        inverse: [{ type: 'addRelationship', commandId: undoId(), relationship: removed, index }],
        touched: [removed.id],
      };
    }

    default:
      return fail('INVALID', `Comando desconocido: "${(cmd as { type: string }).type}".`);
  }
}

function findAnyId(model: UMLModel, id: string): boolean {
  return (
    model.classes.some((c) => c.id === id) || model.relationships.some((r) => r.id === id)
  );
}

function toError(error: unknown, commandId?: string): CommandError {
  if (error instanceof CommandFailure) {
    return { ok: false, code: error.code, message: error.message, commandId };
  }
  throw error;
}

/**
 * Aplica un comando. Si el commandId ya estaba aplicado (ctx.applied), no hace nada.
 * Verifica las huellas `expected` ANTES de modificar nada.
 */
export function applyCommand(
  model: UMLModel,
  cmd: UMLCommand,
  ctx: CommandContext = {},
): CommandResult {
  if (!cmd.commandId) {
    return { ok: false, code: 'INVALID', message: 'El comando necesita un commandId.' };
  }
  if (ctx.applied?.has(cmd.commandId)) {
    return { ok: true, model, inverse: [], touched: [], duplicate: true };
  }
  try {
    checkExpected(model, cmd);
    const next = structuredClone(model);
    const { inverse, touched } = execute(next, cmd);
    return { ok: true, model: next, inverse, touched, duplicate: false };
  } catch (error) {
    return toError(error, cmd.commandId);
  }
}

/**
 * Aplica un lote de forma ATÓMICA: si un comando falla, no se aplica ninguno.
 * `inverse` viene ya en el orden correcto para deshacer todo el lote.
 */
export function applyCommands(
  model: UMLModel,
  commands: UMLCommand[],
  ctx: CommandContext = {},
): CommandResult {
  let current = model;
  const applied = new Set(ctx.applied ?? []);
  const inverse: UMLCommand[] = [];
  const touched = new Set<string>();
  let anyApplied = false;

  for (const cmd of commands) {
    const result = applyCommand(current, cmd, { applied });
    if (!result.ok) return result;
    if (result.duplicate) continue;
    anyApplied = true;
    applied.add(cmd.commandId);
    current = result.model;
    inverse.unshift(...result.inverse);
    result.touched.forEach((id) => touched.add(id));
  }

  return { ok: true, model: current, inverse, touched: [...touched], duplicate: !anyApplied };
}
