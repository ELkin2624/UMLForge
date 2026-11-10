import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useShareStore } from "../../sharing/model/share-store";
import { useAutosave } from "./use-autosave";
import { flushPendingSave } from "./flush";
import { flushRoom } from "../../collaboration/model/command-client";
vi.mock("../../collaboration/model/command-client", () => ({
  flushRoom: vi.fn().mockResolvedValue(undefined),
}));
beforeEach(() => {
  vi.clearAllMocks();
  useShareStore.getState().setRoomId("1");
});
describe("Espera de comandos pendientes", () => {
  it("espera la confirmación del diagrama activo antes de cambiar de contexto", async () => {
    renderHook(() => useAutosave());
    await flushPendingSave();
    expect(flushRoom).toHaveBeenCalledWith("1");
  });
  it("desregistra el handler al salir del diagrama", async () => {
    const { unmount } = renderHook(() => useAutosave());
    unmount();
    await flushPendingSave();
    expect(flushRoom).not.toHaveBeenCalled();
  });
  it("propaga los errores al solicitante para no consultar contexto sin guardar", async () => {
    vi.mocked(flushRoom).mockRejectedValueOnce(new Error("Sin conexión"));
    renderHook(() => useAutosave());
    await expect(flushPendingSave()).rejects.toThrow("Sin conexión");
  });
});
