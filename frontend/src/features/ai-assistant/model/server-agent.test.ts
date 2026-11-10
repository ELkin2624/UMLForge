import { beforeEach, describe, it, expect, vi } from "vitest";
import { useServerAgent } from "./server-agent";
import { request } from "../../../api/client";
import { flushPendingSave } from "../../versioning";
vi.mock("../../../api/client", () => ({ request: vi.fn() }));
vi.mock("../../versioning", () => ({
  flushPendingSave: vi.fn().mockResolvedValue(undefined),
}));
beforeEach(() => {
  vi.clearAllMocks();
  useServerAgent.setState({
    room: null,
    runs: [],
    preview: null,
    mode: "suggest",
    error: null,
    submitting: false,
  });
});
describe("Tareas del agente", () => {
  it("envía el modo elegido y no aplica modelos devueltos en el navegador", async () => {
    vi.mocked(request).mockImplementation(async (path) =>
      path === "/ai/runs" ? { id: "run", execution_mode: "DIRECT" } : [],
    );
    await useServerAgent.getState().start("1", "Crea Cliente");
    expect(flushPendingSave).toHaveBeenCalledOnce();
    const call = vi
      .mocked(request)
      .mock.calls.find(([path]) => path === "/ai/runs");
    expect(JSON.parse(String(call?.[1]?.body)).mode).toBe("suggest");
    useServerAgent.getState().setMode("edit");
    await useServerAgent.getState().start("1", "Ordena las clases");
    const last = vi
      .mocked(request)
      .mock.calls.filter(([path]) => path === "/ai/runs")
      .at(-1);
    expect(JSON.parse(String(last?.[1]?.body)).mode).toBe("edit");
  });
  it("no consulta al agente cuando hay cambios sin confirmar", async () => {
    vi.mocked(flushPendingSave).mockRejectedValueOnce(
      new Error("Conflicto pendiente"),
    );
    await useServerAgent.getState().start("1", "Revisa esta clase");
    expect(request).not.toHaveBeenCalled();
    expect(useServerAgent.getState().error).toBe("Conflicto pendiente");
    expect(useServerAgent.getState().submitting).toBe(false);
  });
  it("una respuesta tardía no muestra tareas de otro diagrama", async () => {
    let release: (value: unknown) => void = () => {};
    vi.mocked(request).mockImplementation(async (path) =>
      path.endsWith("=1")
        ? new Promise((resolve) => {
            release = resolve;
          })
        : [],
    );
    const old = useServerAgent.getState().refresh("1");
    await useServerAgent.getState().refresh("2");
    release([{ id: "privado-1" }]);
    await old;
    expect(useServerAgent.getState().room).toBe("2");
    expect(useServerAgent.getState().runs).toEqual([]);
  });
});
