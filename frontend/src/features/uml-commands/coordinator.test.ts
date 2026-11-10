import { describe, it, expect } from "vitest";
import {
  applyRoomBatch,
  diffModels,
  translatePatches,
} from "../../../../packages/uml-commands/coordinator.ts";
import type { UMLModel } from "../../types/canonical-model";
import type { AIPatch } from "../ai-assistant/types";
const model: UMLModel = {
  classes: [
    {
      id: "cliente",
      name: "Cliente",
      attributes: [{ id: "nombre", name: "nombre", type: "String" }],
      operations: [],
    },
  ],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
};
const patch = (data: Record<string, unknown>): AIPatch => ({
  patch_id: "p",
  operation: "UPDATE_CLASS",
  target: "Cliente",
  data,
  reason: "x",
  requested_by: "Ana",
  status: "pending_approval",
});
describe("Motor compartido del coordinador", () => {
  it("detecta eliminaciones de atributos dentro de UPDATE_CLASS", () => {
    const translated = translatePatches(
      model,
      [patch({ remove_attributes: ["nombre"] })],
      "run",
    );
    expect(translated.ok).toBe(true);
    if (translated.ok && "commands" in translated) {
      const result = applyRoomBatch(
        model,
        {},
        diffModels(model, translated.model, "protected"),
      );
      expect(result.ok && result.destructive).toBe(true);
    }
  });
  it("edita operaciones y exige aprobación cuando elimina una", () => {
    const added = translatePatches(
      model,
      [patch({ add_operations: [{ name: "saludar", return_type: "String" }] })],
      "run",
    );
    expect(added.ok).toBe(true);
    if (added.ok && "model" in added) {
      expect(added.model.classes[0].operations[0].name).toBe("saludar");
      const removed = translatePatches(
        added.model,
        [patch({ remove_operations: ["saludar"] })],
        "next",
      );
      expect(
        removed.ok && "destructive" in removed && removed.destructive,
      ).toBe(true);
    }
  });
  it("mantiene cambios en elementos distintos y rechaza el mismo elemento obsoleto", () => {
    const next = structuredClone(model);
    next.classes[0].name = "Persona";
    const commands = diffModels(model, next, "batch");
    const remote = structuredClone(model);
    remote.classes.push({
      id: "otro",
      name: "Otro",
      attributes: [],
      operations: [],
    });
    const result = applyRoomBatch(remote, {}, commands);
    expect(result.ok && result.model?.classes).toHaveLength(2);
    const conflict = structuredClone(model);
    conflict.classes[0].name = "Remoto";
    expect(applyRoomBatch(conflict, {}, commands).ok).toBe(false);
  });
  it("mueve cajas con inverso protegido sin modificar el modelo canónico", () => {
    const command = {
      type: "moveClass" as const,
      commandId: "move",
      id: "cliente",
      before: null,
      after: { x: 300, y: 100 },
    };
    const result = applyRoomBatch(model, {}, [command]);
    expect(result.ok).toBe(true);
    if (result.ok && result.layout && result.inverse) {
      expect(result.model).toEqual(model);
      expect(
        applyRoomBatch(model, result.layout, result.inverse).layout,
      ).toEqual({});
      expect(
        applyRoomBatch(model, { cliente: { x: 500, y: 100 } }, result.inverse)
          .ok,
      ).toBe(false);
    }
  });
});
