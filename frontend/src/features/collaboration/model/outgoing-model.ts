import type { UMLModel } from "../../../types/canonical-model";

/**
 * Apollon crea toda clase nueva con el mismo nombre ("Class") y el servidor exige nombres
 * únicos (cada clase genera una entidad). Las clases NUEVAS con un nombre ya usado se
 * renombran con un sufijo (Class2, Class3…). Los renombres de clases existentes no se tocan.
 */
export function uniquifyNewClassNames(before: UMLModel, after: UMLModel): UMLModel {
  const previousIds = new Set((before.classes ?? []).map((c) => c.id));
  const taken = new Set(
    (after.classes ?? [])
      .filter((c) => previousIds.has(c.id))
      .map((c) => c.name.trim().toLowerCase()),
  );
  let changed = false;
  const classes = (after.classes ?? []).map((c) => {
    if (previousIds.has(c.id)) return c;
    const base = c.name.trim() || "Class";
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}${n}`;
    taken.add(name.toLowerCase());
    if (name === c.name) return c;
    changed = true;
    return { ...c, name };
  });
  return changed ? { ...after, classes } : after;
}

/**
 * Prepara el modelo que se envía al servidor a partir del cambio local `before -> after`:
 * - conserva el `id` del modelo: cada navegador tiene su propio id interno de Apollon y,
 *   si se enviara, dos clientes se lo pisarían en bucle sin fin;
 * - renombra las clases nuevas con nombre repetido.
 */
export function prepareOutgoingModel(before: UMLModel, after: UMLModel): UMLModel {
  const withStableId = before.id && after.id !== before.id ? { ...after, id: before.id } : after;
  return uniquifyNewClassNames(before, withStableId);
}
