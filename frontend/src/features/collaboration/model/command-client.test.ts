import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../../../api/client";
import { useModelStore } from "../../../store/model-store";
import { useShareStore } from "../../sharing/model/share-store";
import {
  hydrateRoom,
  enqueueModel,
  flushRoom,
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
