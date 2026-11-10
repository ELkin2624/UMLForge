import { create } from "zustand";
import { request } from "../../../api/client";
import { flushPendingSave } from "../../versioning";
import { useModelStore } from "../../../store/model-store";
import type { RoomCommand } from "../../../../../packages/uml-commands/coordinator.ts";

export interface AgentRun {
  id: string;
  diagram_id: number;
  user_id: number;
  user_name: string;
  mode: "suggest" | "edit";
  status: string;
  progress: string;
  reply?: string;
  commands: RoomCommand[];
  destructive?: boolean;
  reasons?: string[];
  context?: {
    truncated?: boolean;
    history_truncated?: boolean;
    messages_truncated?: boolean;
  };
  error?: string;
  undone?: boolean;
}
export interface ProviderStatus {
  provider: string;
  model: string;
  available: boolean;
  detail: string;
}
interface State {
  runs: AgentRun[];
  room: string | null;
  preview: AgentRun | null;
  mode: "suggest" | "edit";
  error: string | null;
  submitting: boolean;
  provider: ProviderStatus | null;
  setMode: (mode: "suggest" | "edit") => void;
  setPreview: (run: AgentRun | null) => void;
  refresh: (room: string) => Promise<void>;
  start: (room: string, prompt: string, image?: string) => Promise<void>;
  action: (
    room: string,
    id: string,
    action: "approve" | "reject" | "cancel" | "undo" | "retry",
  ) => Promise<void>;
  checkProvider: () => Promise<void>;
}
export const useServerAgent = create<State>((set, get) => ({
  runs: [],
  room: null,
  preview: null,
  mode: "suggest",
  error: null,
  submitting: false,
  provider: null,
  setMode: (mode) => set({ mode }),
  setPreview: (preview) => set({ preview }),
  refresh: async (room) => {
    if (get().room !== room)
      set({ room, runs: [], preview: null, error: null });
    try {
      const runs = await request<AgentRun[]>(
        `/ai/runs?diagram_id=${encodeURIComponent(room)}`,
      );
      if (get().room === room)
        set({
          runs,
          preview: get().preview
            ? (runs.find(
                (run) =>
                  run.id === get().preview?.id &&
                  run.status === "awaiting_approval",
              ) ?? null)
            : null,
        });
    } catch (reason) {
      if (get().room === room)
        set({
          error:
            reason instanceof Error
              ? reason.message
              : "No se pudieron leer las tareas.",
        });
    }
  },
  checkProvider: async () => {
    try {
      set({ provider: await request<ProviderStatus>("/ai/provider") });
    } catch {
      set({ provider: null });
    }
  },
  start: async (room, prompt, image) => {
    if (get().submitting) return;
    set({ submitting: true, error: null });
    try {
      await flushPendingSave();
      const selected = useModelStore.getState().selectedNodeId;
      await request<AgentRun>("/ai/runs", {
        method: "POST",
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          diagram_id: Number(room),
          prompt:
            prompt.trim() ||
            "Analiza la imagen y prepara sus clases y relaciones.",
          image_base64: image,
          mode: get().mode,
          selection: selected ? [selected] : [],
        }),
      });
      await get().refresh(room);
    } catch (reason) {
      set({
        error:
          reason instanceof Error
            ? reason.message
            : "No se pudo iniciar la tarea.",
      });
    } finally {
      set({ submitting: false });
    }
  },
  action: async (room, id, action) => {
    set({ error: null });
    try {
      await request(`/ai/runs/${id}/${action}`, { method: "POST" });
      await get().refresh(room);
    } catch (reason) {
      set({
        error:
          reason instanceof Error
            ? reason.message
            : "No se pudo completar la acción.",
      });
    }
  },
}));
