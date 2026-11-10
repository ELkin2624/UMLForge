import type { RoomCommand } from "../../../../../packages/uml-commands/coordinator.ts";
import type { UMLModel } from "../../../types/canonical-model";
interface Member {
  id: string;
  name: string;
  type?: string;
  return_type?: string;
}
interface Element {
  name?: string;
  attributes?: Member[];
  operations?: Member[];
  type?: string;
  source_id?: string;
  target_id?: string;
  source_multiplicity?: string;
  target_multiplicity?: string;
}
export function describeCommand(
  command: RoomCommand,
  model: UMLModel | null,
): string[] {
  if (command.type === "moveClass")
    return [
      `Mover ${model?.classes.find((c) => c.id === command.id)?.name ?? "clase"}`,
    ];
  if (command.type === "replaceMetadata")
    return ["Actualizar los datos del modelo"];
  if (command.type !== "replaceElement")
    return ["Editar el elemento seleccionado"];
  const before = command.before as Element | null,
    after = command.after as Element | null;
  const current = after ?? before;
  const lines = [
    `${after === null ? "Eliminar" : before === null ? "Agregar" : "Modificar"} ${current?.name ?? "relación"}`,
  ];
  if (before && after && before.name !== after.name)
    lines.push(`Nombre: ${before.name} → ${after.name}`);
  for (const field of ["attributes", "operations"] as const) {
    const old = before?.[field] ?? [],
      next = after?.[field] ?? [];
    const label = (member: Member) =>
      `${member.name}${field === "operations" ? "()" : ""}: ${member.type ?? member.return_type ?? "void"}`;
    for (const member of old)
      if (!next.some((x) => x.id === member.id))
        lines.push(`− ${label(member)}`);
    for (const member of next) {
      const previous = old.find((x) => x.id === member.id);
      if (!previous) lines.push(`+ ${label(member)}`);
      else if (label(previous) !== label(member))
        lines.push(`${label(previous)} → ${label(member)}`);
    }
  }
  if (current?.source_id && current.target_id) {
    const name = (id: string) =>
      model?.classes.find((c) => c.id === id)?.name ?? "clase";
    lines.push(
      `${name(current.source_id)} — ${name(current.target_id)} · ${current.type ?? "asociación"}`,
    );
    if (current.source_multiplicity || current.target_multiplicity)
      lines.push(
        `${current.source_multiplicity ?? ""} — ${current.target_multiplicity ?? ""}`,
      );
  }
  return lines;
}
