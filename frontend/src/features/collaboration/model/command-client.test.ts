import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../../../api/client";
import { useModelStore } from "../../../store/model-store";
import { useShareStore } from "../../sharing/model/share-store";
import {
  hydrateRoom,
  enqueueModel,
  enqueuePosition,
  flushRoom,
  knownLayout,
  onRoomLayout,
  receiveRoom,
  useCommandConflict,
} from "./command-client";
import { applyRoomBatch } from "../../../../../packages/uml-commands/coordinator.ts";
import type { UMLModel } from "../../../types/canonical-model";
vi.mock("../../../api/client", () => ({ request: vi.fn() }));
const model = (name: string): UMLModel => ({
  classes: [{ id: "a", name, attributes: [], operations: [] }],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
});
let room: string;
beforeEach(() => {
  vi.clearAllMocks();
  room = String(Math.floor(Math.random() * 100000) + 100);
  useShareStore.getState().setRoomId(room);
  useCommandConflict.getState().dismiss();
});
describe("Confirmación de comandos humanos", () => {
  it("publica comandos protegidos y adopta la revisión confirmada", async () => {
    hydrateRoom(room, { data: model("Antes"), layout: {}, revision: 1 });
    vi.mocked(request).mockImplementation(async (_path, options) => {
      const payload = JSON.parse(String(options?.body));
      const result = applyRoomBatch(model("Antes"), {}, payload.commands);
      if (!result.ok) throw new Error("Inválido");
      return { data: result.model, layout: result.layout, revision: 2 };
    });
    enqueueModel(room, model("Antes"), model("Después"));
    await flushRoom(room);
    expect(request).toHaveBeenCalledWith(
      `/diagrams/${room}/commands`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(useModelStore.getState().model?.classes[0].name).toBe("Después");
  });
  it("conserva un conflicto para revisión y no reenvía un snapshot completo", async () => {
    hydrateRoom(room, { data: model("Antes"), layout: {}, revision: 1 });
    vi.mocked(request).mockImplementation(async (path) => {
      if (path.includes("/commands")) throw new Error("El elemento cambió");
      return { data: model("Cambio remoto"), layout: {}, version: 2 };
    });
    enqueueModel(room, model("Antes"), model("Cambio local"));
    await expect(flushRoom(room)).rejects.toThrow("Revisa");
    expect(useCommandConflict.getState().commands).toHaveLength(1);
    expect(useModelStore.getState().model?.classes[0].name).toBe(
      "Cambio remoto",
    );
    expect(
      vi
        .mocked(request)
        .mock.calls.filter(([path]) => path.endsWith("/commands")),
    ).toHaveLength(1);
  });
  it("un rechazo de solo posiciones no bloquea el editor y adopta la posición del servidor", async () => {
    hydrateRoom(room, { data: model("Antes"), layout: {}, revision: 1 });
    vi.mocked(request).mockImplementation(async (path) => {
      if (path.includes("/commands")) throw new Error("La posición cambió.");
      return { data: model("Antes"), layout: { a: { x: 450, y: 365 } }, version: 2 };
    });
    enqueuePosition(room, "a", { x: 780, y: 60 });
    await flushRoom(room);
    expect(useCommandConflict.getState().message).toBeFalsy();
  });
  it("al confirmarse un paso intermedio no devuelve atrás una posición aún en cola", () => {
    hydrateRoom(room, { data: model("Antes"), layout: { a: { x: 0, y: 0 } }, revision: 1 });
    const seen: Array<{ x: number; y: number } | undefined> = [];
    const off = onRoomLayout((r, layout) => { if (r === room) seen.push(layout.a); });
    enqueuePosition(room, "a", { x: 300, y: 0 });
    receiveRoom(room, { data: model("Antes"), layout: { a: { x: 100, y: 0 } }, revision: 2 });
    off();
    expect(seen.at(-1)).toEqual({ x: 300, y: 0 });
  });
  it("conoce las posiciones recibidas al abrir el diagrama y las que están en cola", () => {
    hydrateRoom(room, { data: model("Antes"), layout: { a: { x: 10, y: 20, width: 300 } }, revision: 1 });
    expect(knownLayout(room)).toEqual({ a: { x: 10, y: 20, width: 300 } });
    enqueuePosition(room, "a", { x: 90, y: 20, width: 300 });
    expect(knownLayout(room).a).toEqual({ x: 90, y: 20, width: 300 });
  });
  it("una clase nueva se envía con su posición en el mismo lote", async () => {
    const empty: UMLModel = { ...model("x"), classes: [] };
    hydrateRoom(room, { data: empty, layout: {}, revision: 1 });
    const sent: Array<{ commands: Array<{ type: string }> }> = [];
    vi.mocked(request).mockImplementation(async (_path, options) => {
      const payload = JSON.parse(String(options?.body));
      sent.push(payload);
      const result = applyRoomBatch(empty, {}, payload.commands);
      if (!result.ok) throw new Error("Inválido");
      return { data: result.model, layout: result.layout, revision: 2 };
    });
    enqueuePosition(room, "a", { x: 400, y: 300 });
    enqueueModel(room, empty, model("Nueva"));
    await flushRoom(room);
    expect(sent).toHaveLength(1);
    expect(sent[0].commands.map((c) => c.type)).toEqual(["replaceElement", "moveClass"]);
  });
  it("descarta publicaciones de revisiones anteriores", () => {
    hydrateRoom(room, { data: model("Nuevo"), layout: {}, revision: 5 });
    receiveRoom(room, { data: model("Viejo"), layout: {}, revision: 2 });
    expect(useModelStore.getState().model?.classes[0].name).toBe("Nuevo");
  });
});

it("recupera una confirmación cuando se pierde la respuesta del POST", async () => {
  hydrateRoom(room, { data: model("Antes"), layout: {}, revision: 1 });
  vi.mocked(request).mockImplementation(async (path) => {
    if (path.endsWith("/commands")) throw new Error("Se perdió la respuesta");
    return { data: model("Confirmado"), layout: {}, revision: 2 };
  });
  enqueueModel(room, model("Antes"), model("Confirmado"));
  await flushRoom(room);
  expect(useCommandConflict.getState().message).toBeNull();
  expect(useModelStore.getState().model?.classes[0].name).toBe("Confirmado");
});
