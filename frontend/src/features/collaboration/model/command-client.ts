import { create } from "zustand";
import { request } from "../../../api/client";
import { useModelStore } from "../../../store/model-store";
import { useShareStore } from "../../sharing/model/share-store";
import { useVersioningStore } from "../../versioning/model/versioning-store";
import {
  applyRoomBatch,
  diffModels,
  equal,
  type RoomCommand,
  type Positions,
} from "../../../../../packages/uml-commands/coordinator.ts";
import type { UMLModel } from "../../../types/canonical-model";

export interface RoomState {
  data: UMLModel;
  layout: Positions;
  revision: number;
}
interface Pending {
  base_revision: number;
  batch_id: string;
  commands: RoomCommand[];
}
interface Session {
  state: RoomState;
  pending: Pending[];
  inFlight: Promise<void> | null;
  buffered?: RoomState;
}
const sessions = new Map<string, Session>();
const listeners = new Set<(room: string, layout: Positions) => void>();
export const useCommandConflict = create<{
  room: string | null;
  message: string | null;
  commands: RoomCommand[];
  dismiss: () => void;
}>((set) => ({
  room: null,
  message: null,
  commands: [],
  dismiss: () => set({ message: null, commands: [] }),
}));
const active = (room: string) => useShareStore.getState().roomId === room;
export function roomState(room: string): RoomState | undefined {
  return sessions.get(room)?.state;
}
export function hydrateRoom(room: string, state: RoomState): void {
  const session = sessions.get(room);
  if (!session) {
    sessions.set(room, { state, pending: [], inFlight: null });
    return;
  }
  if (state.revision < session.state.revision) return;
  if (session.inFlight) {
    session.buffered = state;
    return;
  }
  session.state = state;
}
function render(room: string): void {
  const session = sessions.get(room);
  if (!session || !active(room)) return;
  let state = session.state;
  for (const batch of session.pending) {
    const result = applyRoomBatch(
      state.data,
      state.layout,
      structuredClone(batch.commands),
    );
    if (result.ok === true && result.model && result.layout)
      state = { ...state, data: result.model, layout: result.layout };
  }
  useModelStore.getState().setModelFromRemote(state.data);
  listeners.forEach((listener) => listener(room, state.layout));
}
export function receiveRoom(room: string, state: RoomState): void {
  hydrateRoom(room, state);
  if (!sessions.get(room)?.inFlight) render(room);
}
export function onRoomLayout(
  listener: (room: string, layout: Positions) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function conflict(room: string, batch: Pending, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "No se pudo guardar el cambio.";
  const previous = useCommandConflict.getState();
  useCommandConflict.setState({
    room,
    message,
    commands:
      previous.room === room && previous.message
        ? [...previous.commands, ...batch.commands]
        : batch.commands,
  });
  useVersioningStore.getState().setSaveState("error", message);
}
export async function flushRoom(room: string): Promise<void> {
  const visualTimer = visualTimers.get(room);
  if (visualTimer) {
    clearTimeout(visualTimer);
    visualTimers.delete(room);
    const queued = visualQueue.get(room);
    visualQueue.delete(room);
    queued?.forEach((position, id) => commitPosition(room, id, position));
  }
  const session = sessions.get(room);
  if (!session) return;
  if (session.inFlight) {
    await session.inFlight;
    return flushRoom(room);
  }
  if (!session.pending.length) {
    if (
      useCommandConflict.getState().room === room &&
      useCommandConflict.getState().message
    )
      throw new Error(
        "Revisa los cambios que no se guardaron antes de continuar.",
      );
    return;
  }
  const batch = session.pending[0];
  session.inFlight = (async () => {
    try {
      useVersioningStore.getState().setSaveState("saving");
      const result = await request<RoomState>(`/diagrams/${room}/commands`, {
        method: "POST",
        body: JSON.stringify(batch),
      });
      session.state = result;
      session.pending.shift();
      useVersioningStore.getState().markSaved(true);
    } catch (error) {
      session.pending.shift();
      // Una respuesta perdida no implica que el servidor haya rechazado el lote.
      const receipt = await request<RoomState>(
        `/diagrams/${room}/commands/${encodeURIComponent(batch.batch_id)}`,
      ).catch(() => null);
      if (receipt) {
        session.state = receipt;
        useVersioningStore.getState().markSaved(true);
      } else {
        conflict(room, batch, error);
        const latest = await request<{
          data: UMLModel;
          layout?: Positions;
          version: number;
        }>(`/diagrams/${room}`).catch(() => null);
        if (latest)
          session.state = {
            data: latest.data,
            layout: latest.layout ?? {},
            revision: latest.version,
          };
      }
    } finally {
      if (
        session.buffered &&
        session.buffered.revision > session.state.revision
      )
        session.state = session.buffered;
      session.buffered = undefined;
      session.inFlight = null;
      render(room);
    }
  })();
  await session.inFlight;
  await flushRoom(room);
}
export function enqueueCommands(room: string, commands: RoomCommand[]): void {
  if (!commands.length) return;
  const session = sessions.get(room);
  if (!session) throw new Error("El diagrama aún no se sincronizó.");
  session.pending.push({
    base_revision: session.state.revision,
    batch_id: crypto.randomUUID(),
    commands,
  });
  void flushRoom(room).catch(() => undefined);
}
export function enqueueModel(
  room: string,
  before: UMLModel,
  after: UMLModel,
): void {
  const id = crypto.randomUUID();
  enqueueCommands(room, diffModels(before, after, id));
}
const visualQueue = new Map<
  string,
  Map<string, { x: number; y: number } | null>
>();
const visualTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function enqueuePosition(
  room: string,
  id: string,
  after: { x: number; y: number } | null,
): void {
  let pending = visualQueue.get(room);
  if (!pending) {
    pending = new Map();
    visualQueue.set(room, pending);
  }
  pending.set(id, after);
  if (visualTimers.has(room)) return;
  visualTimers.set(
    room,
    setTimeout(() => {
      visualTimers.delete(room);
      const values = visualQueue.get(room);
      visualQueue.delete(room);
      values?.forEach((position, nodeId) =>
        commitPosition(room, nodeId, position),
      );
    }, 50),
  );
}
function commitPosition(
  room: string,
  id: string,
  after: { x: number; y: number } | null,
): void {
  const session = sessions.get(room);
  if (!session) return;
  let layout = session.state.layout;
  for (const batch of session.pending) {
    const moves = batch.commands.filter((cmd) => cmd.type === "moveClass");
    layout = { ...layout };
    for (const cmd of moves)
      if (cmd.after) layout[cmd.id] = cmd.after;
      else delete layout[cmd.id];
  }
  const before = layout[id] ?? null;
  if (!equal(before, after))
    enqueueCommands(room, [
      { type: "moveClass", commandId: crypto.randomUUID(), id, before, after },
    ]);
}
