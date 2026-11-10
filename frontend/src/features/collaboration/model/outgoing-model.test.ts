import { describe, it, expect } from "vitest";
import type { UMLModel } from "../../../types/canonical-model";
import { prepareOutgoingModel, uniquifyNewClassNames } from "./outgoing-model";

const model = (...classes: Array<[string, string]>) =>
  ({ id: "m", name: "m", classes: classes.map(([id, name]) => ({ id, name })), relationships: [] }) as unknown as UMLModel;
const names = (m: UMLModel) => m.classes.map((c) => c.name);

describe("uniquifyNewClassNames", () => {
  it("renombra una clase nueva con nombre repetido", () => {
    const out = uniquifyNewClassNames(model(["a", "Class"]), model(["a", "Class"], ["b", "Class"]));
    expect(names(out)).toEqual(["Class", "Class2"]);
  });

  it("busca el siguiente sufijo libre y no distingue mayúsculas", () => {
    const before = model(["a", "Class"], ["b", "class2"]);
    const out = uniquifyNewClassNames(before, model(["a", "Class"], ["b", "class2"], ["c", "Class"]));
    expect(names(out)).toEqual(["Class", "class2", "Class3"]);
  });

  it("varias clases nuevas a la vez reciben nombres distintos", () => {
    const out = uniquifyNewClassNames(model(), model(["a", "Class"], ["b", "Class"]));
    expect(names(out)).toEqual(["Class", "Class2"]);
  });

  it("no toca renombres de clases existentes ni devuelve un modelo nuevo sin cambios", () => {
    const before = model(["a", "Cliente"], ["b", "Pedido"]);
    const after = model(["a", "Pedido"], ["b", "Pedido"]);
    expect(uniquifyNewClassNames(before, after)).toBe(after);
  });
});

describe("prepareOutgoingModel", () => {
  it("no cambia el id del modelo por el id interno de Apollon de este navegador", () => {
    const before = { ...model(["a", "Class"]), id: "id-del-servidor" } as UMLModel;
    const after = { ...model(["a", "Class"]), id: "id-local-apollon" } as UMLModel;
    expect(prepareOutgoingModel(before, after).id).toBe("id-del-servidor");
  });

  it("también renombra clases nuevas repetidas", () => {
    const out = prepareOutgoingModel(model(["a", "Class"]), model(["a", "Class"], ["b", "Class"]));
    expect(names(out)).toEqual(["Class", "Class2"]);
  });
});
