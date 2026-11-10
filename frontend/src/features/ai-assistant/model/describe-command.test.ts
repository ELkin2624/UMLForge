import { describe, it, expect } from "vitest";
import { describeCommand } from "./describe-command";
import type { UMLModel } from "../../../types/canonical-model";
const model = {
  classes: [{ id: "c", name: "Cliente", attributes: [], operations: [] }],
  relationships: [],
} as unknown as UMLModel;
describe("Vista previa de cambios", () => {
  it("explica nombres, atributos y operaciones antes de aprobar", () => {
    const lines = describeCommand(
      {
        type: "replaceElement",
        commandId: "x",
        collection: "classes",
        id: "c",
        before: {
          name: "Cliente",
          attributes: [{ id: "a", name: "edad", type: "Integer" }],
          operations: [],
        },
        after: {
          name: "Persona",
          attributes: [{ id: "b", name: "nombre", type: "String" }],
          operations: [{ id: "o", name: "saludar", return_type: "String" }],
        },
      },
      model,
    );
    expect(lines).toContain("Nombre: Cliente → Persona");
    expect(lines).toContain("− edad: Integer");
    expect(lines).toContain("+ nombre: String");
    expect(lines).toContain("+ saludar(): String");
  });
  it("identifica movimientos por el nombre visible de la clase", () => {
    expect(
      describeCommand(
        {
          type: "moveClass",
          commandId: "m",
          id: "c",
          before: null,
          after: { x: 100, y: 200 },
        },
        model,
      ),
    ).toEqual(["Mover Cliente"]);
  });
});
