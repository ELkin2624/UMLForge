import { useEffect, useState, type RefObject } from "react";
import type { ApollonEditor } from "@tumaet/apollon";
import { describeCommand } from "../model/describe-command";
import { useModelStore } from "../../../store/model-store";
import { useServerAgent } from "../model/server-agent";
import { useCommandConflict } from "../../collaboration/model/command-client";
import { useShareStore } from "../../sharing/model/share-store";
import "./AgentPreview.css";

export function AgentPreview({
  editorRef,
}: {
  editorRef: RefObject<ApollonEditor | null>;
}) {
  const preview = useServerAgent((s) => s.preview);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!preview) return;
    const timer = window.setInterval(() => tick((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [preview]);
  const room = useShareStore((s) => s.roomId);
  if (
    !preview ||
    String(preview.diagram_id) !== room ||
    preview.status !== "awaiting_approval"
  )
    return null;
  const container = document.querySelector(".case-editor");
  const parent = container?.getBoundingClientRect();
  const boxes = preview.commands.flatMap((cmd, index) => {
    if (!("id" in cmd)) return [];
    const node = container?.querySelector(
      `.react-flow__node[data-id="${CSS.escape(cmd.id)}"]`,
    );
    const rect = node?.getBoundingClientRect();
    const position = cmd.type === "moveClass" ? cmd.after : null;
    const screen = position
      ? editorRef.current?.flowToScreenPosition(position)
      : null;
    const left =
      screen && parent
        ? screen.x - parent.left
        : rect && parent
          ? rect.left - parent.left
          : 40 + (index % 3) * 250;
    const top =
      screen && parent
        ? screen.y - parent.top
        : rect && parent
          ? rect.top - parent.top
          : 50 + Math.floor(index / 3) * 160;
    const label =
      cmd.type === "moveClass"
        ? "Mover aquí"
        : cmd.type === "replaceElement"
          ? cmd.after === null
            ? "Eliminar"
            : cmd.before === null
              ? "Agregar"
              : "Modificar"
          : "Editar";
    const name =
      cmd.type === "replaceElement" &&
      cmd.after &&
      typeof cmd.after === "object" &&
      "name" in cmd.after
        ? String(cmd.after.name)
        : "";
    return [
      <div
        key={cmd.commandId}
        className={`agent-preview agent-preview--${label === "Eliminar" ? "remove" : "change"}`}
        style={{
          left,
          top,
          width: rect?.width ?? 220,
          height: rect?.height ?? 110,
        }}
      >
        <span>
          {label} {name}
        </span>
      </div>,
    ];
  });
  return (
    <div
      className="agent-preview-layer"
      aria-label="Vista previa de la propuesta"
    >
      {boxes}
    </div>
  );
}
export function CommandConflictBanner() {
  const conflict = useCommandConflict();
  const model = useModelStore((s) => s.model);
  const room = useShareStore((s) => s.roomId);
  if (!conflict.message || conflict.room !== room) return null;
  return (
    <div className="command-conflict" role="alert">
      <strong>Tu cambio no se guardó</strong>
      <p>{conflict.message}</p>
      <details>
        <summary>Revisar el cambio pendiente</summary>
        {conflict.commands.flatMap((cmd) =>
          describeCommand(cmd, model).map((line, index) => (
            <p key={`${cmd.commandId}:${index}`}>{line}</p>
          )),
        )}
      </details>
      <button onClick={conflict.dismiss}>Descartar aviso</button>
    </div>
  );
}
