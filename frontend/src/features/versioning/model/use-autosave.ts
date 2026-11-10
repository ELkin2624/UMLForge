import { useEffect } from "react";
import { useShareStore } from "../../sharing/model/share-store";
import { flushRoom } from "../../collaboration/model/command-client";
import { registerFlushHandler } from "./flush";

export const AUTOSAVE_DEBOUNCE_MS = 3000;
export const AUTOSAVE_RETRY_MS = 10000;

/** Los comandos se guardan al confirmarse; este hook permite esperar los pendientes. */
export function useAutosave(): void {
  const roomId = useShareStore((s) => s.roomId);
  useEffect(() => {
    if (!roomId) return;
    registerFlushHandler(() => flushRoom(roomId));
    return () => registerFlushHandler(null);
  }, [roomId]);
}
