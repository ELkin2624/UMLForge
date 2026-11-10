import type { UMLModel } from "./canonical-model.ts";
import { applyCommands } from "./engine.ts";
import { patchToCommands } from "./patch-to-commands.ts";
import type { AIPatch } from "./patch-types.ts";
import type { UMLCommand } from "./types.ts";

export type Positions = Record<string, { x: number; y: number }>;
export interface MoveCommand {
  type: "moveClass";
  commandId: string;
  id: string;
  before: { x: number; y: number } | null;
  after: { x: number; y: number } | null;
}
export interface MetadataCommand {
  type: "replaceMetadata";
  commandId: string;
  key: "id" | "name" | "uml_version";
  before: unknown;
  after: unknown;
}
export type RoomCommand = UMLCommand | MoveCommand | MetadataCommand;
export const equal = (a: unknown, b: unknown): boolean => {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, val]) => val !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, val]) => [k, stable(val)]),
          )
        : v;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
};
const collections = [
  "classes",
  "relationships",
  "components",
  "interfaces",
  "ports",
  "connectors",
  "dependencies",
  "diagrams",
] as const;
export function diffModels(
  before: UMLModel,
  after: UMLModel,
  batchId: string,
): RoomCommand[] {
  const commands: RoomCommand[] = [];
  for (const collection of collections) {
    const oldItems = (before[collection] ?? []) as { id: string }[];
    const newItems = (after[collection] ?? []) as { id: string }[];
    for (const id of new Set([...oldItems, ...newItems].map((x) => x.id))) {
      const old = oldItems.find((x) => x.id === id) ?? null;
      const next = newItems.find((x) => x.id === id) ?? null;
      if (!equal(old, next))
        commands.push({
          type: "replaceElement",
          commandId: `${batchId}:${commands.length}`,
          collection,
          id,
          before: old,
          after: next,
        });
    }
  }
  for (const key of ["id", "name", "uml_version"] as const) {
    if (!equal(before[key] ?? null, after[key] ?? null))
      commands.push({
        type: "replaceMetadata",
        commandId: `${batchId}:meta:${key}`,
        key,
        before: before[key] ?? null,
        after: after[key] ?? null,
      });
  }
  return commands;
}
export function destructive(commands: RoomCommand[]): boolean {
  return commands.some((cmd) => {
    if (cmd.type.startsWith("delete")) return true;
    if (cmd.type !== "replaceElement") return false;
    if (cmd.after === null) return true;
    if (cmd.collection !== "classes" || !cmd.before) return false;
    const old = cmd.before as {
      attributes?: { id: string }[];
      operations?: { id: string }[];
    };
    const next = cmd.after as typeof old;
    return (["attributes", "operations"] as const).some((key) =>
      (old[key] ?? []).some(
        (x: { id: string }) =>
          !(next[key] ?? []).some((y: { id: string }) => x.id === y.id),
      ),
    );
  });
}
export type RoomResult =
  | {
      ok: true;
      model: UMLModel;
      layout: Positions;
      inverse: RoomCommand[];
      touched: string[];
      destructive: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
      model?: never;
      layout?: never;
      inverse?: never;
      touched?: never;
      destructive?: never;
    };
export function applyRoomBatch(
  model: UMLModel,
  positions: Positions,
  commands: RoomCommand[],
): RoomResult {
  let current = structuredClone(model);
  current.classes ??= [];
  current.relationships ??= [];
  const layout = structuredClone(positions);
  const inverse: RoomCommand[] = [];
  const touched = new Set<string>();
  for (const cmd of commands) {
    if (cmd.type === "replaceMetadata") {
      if (!["id", "name", "uml_version"].includes(cmd.key))
        return { ok: false, code: "INVALID", message: "Metadato inválido." };
      if (!equal(current[cmd.key] ?? null, cmd.before))
        return {
          ok: false,
          code: "CONFLICT",
          message: "Los datos del modelo cambiaron.",
        };
      if (
        cmd.after !== null &&
        (typeof cmd.after !== "string" || cmd.after.length > 500)
      )
        return { ok: false, code: "INVALID", message: "Metadato inválido." };
      if (cmd.after === null) delete current[cmd.key];
      else current[cmd.key] = cmd.after as string;
      inverse.unshift({
        ...cmd,
        commandId: `${cmd.commandId}:undo`,
        before: cmd.after,
        after: cmd.before,
      });
      continue;
    }
    if (cmd.type === "moveClass") {
      if (!equal(layout[cmd.id] ?? null, cmd.before))
        return { ok: false, code: "CONFLICT", message: "La posición cambió." };
      if (
        cmd.after &&
        (!Number.isFinite(cmd.after.x) ||
          !Number.isFinite(cmd.after.y) ||
          Math.abs(cmd.after.x) > 1e6 ||
          Math.abs(cmd.after.y) > 1e6)
      )
        return { ok: false, code: "INVALID", message: "Posición inválida." };
      if (
        cmd.after &&
        !current.classes.some((x) => x.id === cmd.id) &&
        !["components", "interfaces", "ports"].some((key) =>
          (
            (current as unknown as Record<string, { id: string }[]>)[key] ?? []
          ).some((x: { id: string }) => x.id === cmd.id),
        )
      )
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "El elemento ya no existe.",
        };
      if (cmd.after) layout[cmd.id] = cmd.after;
      else delete layout[cmd.id];
      inverse.unshift({
        ...cmd,
        commandId: `${cmd.commandId}:undo`,
        before: cmd.after,
        after: cmd.before,
      });
      touched.add(cmd.id);
      continue;
    }
    // Normalizar igualdad para objetos recibidos desde JSON con diferente orden de claves.
    if (cmd.type === "replaceElement") {
      const elements = ((
        current as unknown as Record<string, { id: string }[]>
      )[cmd.collection] ?? []) as { id: string }[];
      const old = elements.find((x) => x.id === cmd.id) ?? null;
      if (!equal(old, cmd.before))
        return { ok: false, code: "CONFLICT", message: "El elemento cambió." };
      cmd.before = old;
    }
    if (
      [
        "renameClass",
        "deleteClass",
        "updateAttribute",
        "deleteAttribute",
        "updateRelationship",
        "deleteRelationship",
      ].includes(cmd.type) &&
      !cmd.expected
    )
      return {
        ok: false,
        code: "INVALID",
        message: "Falta la huella del elemento que se va a modificar.",
      };
    const result = applyCommands(current, [cmd]);
    if (!result.ok) return result;
    current = result.model;
    inverse.unshift(...result.inverse);
    result.touched.forEach((id) => touched.add(id));
  }
  // No permitir relaciones huérfanas ni nombres duplicados al adaptar snapshots.
  for (const cls of current.classes) {
    if (
      typeof cls.id !== "string" ||
      typeof cls.name !== "string" ||
      !cls.name.trim() ||
      !Array.isArray(cls.attributes) ||
      !Array.isArray(cls.operations)
    )
      return {
        ok: false,
        code: "INVALID",
        message: "La clase no tiene una estructura válida.",
      };
    if (
      cls.attributes.some(
        (a) =>
          typeof a.id !== "string" ||
          typeof a.name !== "string" ||
          !a.name.trim() ||
          typeof a.type !== "string" ||
          !a.type.trim(),
      )
    )
      return {
        ok: false,
        code: "INVALID",
        message: "El atributo necesita nombre, tipo e identificador.",
      };
    if (
      new Set(cls.attributes.map((a) => a.name.trim().toLowerCase())).size !==
        cls.attributes.length ||
      new Set(cls.attributes.map((a) => a.id)).size !== cls.attributes.length
    )
      return {
        ok: false,
        code: "INVALID",
        message: "Hay atributos duplicados.",
      };
    if (
      cls.operations.some(
        (o) =>
          typeof o.id !== "string" ||
          typeof o.name !== "string" ||
          !o.name.trim(),
      )
    )
      return {
        ok: false,
        code: "INVALID",
        message: "La operación necesita nombre e identificador.",
      };
  }
  const ids = new Set(current.classes.map((x) => x.id));
  if (ids.size !== current.classes.length)
    return {
      ok: false,
      code: "INVALID",
      message: "Hay identificadores de clase duplicados.",
    };
  if (
    new Set(current.classes.map((x) => x.name.trim().toLowerCase())).size !==
    current.classes.length
  )
    return {
      ok: false,
      code: "DUPLICATE_NAME",
      message: "Hay nombres de clase repetidos.",
    };
  if (
    !current.components?.length &&
    current.relationships.some(
      (r) => !ids.has(r.source_id) || !ids.has(r.target_id),
    )
  )
    return {
      ok: false,
      code: "INVALID",
      message: "Hay relaciones sin clases.",
    };
  return {
    ok: true,
    model: current,
    layout,
    inverse,
    touched: [...touched],
    destructive: destructive(commands),
  };
}
export function translatePatches(
  model: UMLModel,
  patches: AIPatch[],
  batchId: string,
) {
  let current = structuredClone(model);
  current.classes ??= [];
  current.relationships ??= [];
  const commands: UMLCommand[] = [];
  let count = 0;
  for (const patch of patches) {
    const translated = patchToCommands(
      current,
      patch,
      () => `${batchId}-${++count}`,
    );
    if (!translated.ok) return translated;
    const result = applyCommands(current, translated.commands);
    if (!result.ok) return result;
    current = result.model;
    commands.push(...translated.commands);
  }
  return {
    ok: true,
    commands,
    model: current,
    destructive: destructive(commands),
  };
}
