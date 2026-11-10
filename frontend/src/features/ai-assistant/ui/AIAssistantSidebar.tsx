import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, X, Send, Mic, Image as ImageIcon } from "lucide-react";
import { describeCommand } from "../model/describe-command";
import { useServerAgent } from "../model/server-agent";
import { fetchPrivateHistory, clearPrivateHistory } from "../api/ai-api";
import type { ChatMessage } from "../types";
import { useShareStore } from "../../sharing/model/share-store";
import { canEdit } from "../../sharing/model/capabilities";
import { useAuthStore } from "../../auth/store";
import { useModelStore } from "../../../store/model-store";
import { SpeechEngine } from "../../voice/api/speech-engine";
import { WhisperEngine } from "../../voice/api/whisper-engine";
import { AuditFeedTab } from "./AuditFeedTab";
import "./ServerAgent.css";

export const AIAssistantSidebar = () => {
  const [open, setOpen] = useState(() => window.innerWidth >= 900);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [tab, setTab] = useState<"chat" | "tasks" | "audit">("chat");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const speech = useRef<SpeechEngine | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const room = useShareStore((s) => s.roomId);
  const role = useShareStore((s) => s.localRole);
  const user = useAuthStore((s) => s.user);
  const connection = useModelStore((s) => s.collaboration.status);
  const model = useModelStore((s) => s.model);
  const agent = useServerAgent();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const editable = canEdit(role) && connection === "synced";
  useEffect(() => {
    speech.current = new SpeechEngine();
    return () => speech.current?.dispose();
  }, []);
  useEffect(() => {
    if (!room || !/^\d+$/.test(room)) return;
    let cancelled = false;
    setMessages([]);
    const refresh = async () => {
      await agent.refresh(room);
      if (!cancelled && user) {
        const history = await fetchPrivateHistory(room).catch(() => []);
        if (!cancelled) setMessages(history);
      }
    };
    void refresh();
    void agent.checkProvider();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [room, user?.id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!room || (!text.trim() && !image) || !editable) return;
    await agent.start(room, text, image);
    if (!useServerAgent.getState().error) {
      setText("");
      setImage(undefined);
      setTab("tasks");
    }
  }
  function attach(blob: File) {
    if (blob.size > 6_000_000) {
      setVoiceError("La imagen debe pesar menos de 6 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(blob);
  }
  async function microphone() {
    setVoiceError(null);
    try {
      if (recording) {
        setRecording(false);
        setTranscribing(true);
        const audio = await speech.current?.stopRecording();
        if (audio) setText(await new WhisperEngine().transcribe(audio));
      } else {
        await speech.current?.startRecording();
        setRecording(true);
      }
    } catch (reason) {
      setVoiceError(
        reason instanceof Error ? reason.message : "No se pudo transcribir.",
      );
    } finally {
      setTranscribing(false);
    }
  }
  const provider = agent.provider;
  const available = provider
    ? `${provider.provider} · ${provider.model}${provider.available ? "" : " · no disponible"}`
    : "Disponibilidad sin verificar";
  const runs = agent.room === room ? agent.runs : [];
  if (!open)
    return (
      <button
        className="agent-open"
        onClick={() => setOpen(true)}
        aria-label="Abrir agente"
      >
        <Bot size={18} /> Agente
      </button>
    );
  return (
    <aside className="server-agent" aria-label="Agente colaborador">
      <header>
        <strong>
          <Bot size={18} /> Agente colaborador
        </strong>
        <button onClick={() => setOpen(false)} aria-label="Cerrar agente">
          <X size={18} />
        </button>
      </header>
      <p className="agent-provider">
        {available}{" "}
        <button onClick={() => void agent.checkProvider()}>Verificar</button>
      </p>
      <p>
        Actúa cuando se lo pides. El propietario puede desactivarlo en Compartir.
      </p>
      <nav aria-label="Secciones del agente">
        {(["chat", "tasks", "audit"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "chat"
              ? "Chat privado"
              : value === "tasks"
                ? "Tareas y propuestas"
                : "Actividad"}
          </button>
        ))}
      </nav>
      {(agent.error || voiceError) && (
        <p role="alert">{agent.error || voiceError}</p>
      )}
      <div className="agent-scroll">
        {tab === "chat" && (
          <>
            <button
              onClick={() =>
                room &&
                user &&
                void clearPrivateHistory(room).then(() => setMessages([]))
              }
            >
              Limpiar chat privado
            </button>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`agent-message agent-message--${message.role}`}
              >
                <strong>
                  {message.role === "user"
                    ? "Tú"
                    : message.role === "model"
                      ? "Agente"
                      : "Sistema"}
                </strong>
                <p>{message.content}</p>
              </article>
            ))}
          </>
        )}
        {tab === "audit" && <AuditFeedTab />}
        {tab === "tasks" && (
          <>
            {!runs.length && <p>No hay tareas en este diagrama.</p>}
            {runs.map((run) => (
              <article key={run.id} className="agent-task">
                <strong>
                  {run.user_name} · {run.mode === "edit" ? "Editar" : "Sugerir"}
                </strong>
                <p>{run.progress}</p>
                {run.error && <p role="alert">{run.error}</p>}
                {run.reply && <p>{run.reply}</p>}
                {(run.context?.truncated ||
                  run.context?.history_truncated ||
                  run.context?.messages_truncated) && (
                  <p>
                    Se utilizó un resumen parcial del contexto. Selecciona una
                    clase para consultar sus detalles.
                  </p>
                )}
                {run.reasons?.map((reason, index) => (
                  <p key={index}>Motivo compartido: {reason}</p>
                ))}
                {run.commands.length > 0 && (
                  <details>
                    <summary>{run.commands.length} cambios preparados</summary>
                    {run.commands.flatMap((cmd) =>
                      describeCommand(cmd, model).map((line, index) => (
                        <p key={`${cmd.commandId}:${index}`}>{line}</p>
                      )),
                    )}
                  </details>
                )}
                {run.status === "awaiting_approval" && (
                  <>
                    <button
                      onClick={() =>
                        agent.setPreview(
                          agent.preview?.id === run.id ? null : run,
                        )
                      }
                    >
                      Vista previa en el lienzo
                    </button>
                    <p>
                      {run.destructive
                        ? "Incluye eliminaciones: requiere aprobación explícita."
                        : "Los cambios aún no están aplicados."}
                    </p>
                    <button
                      disabled={!editable}
                      onClick={() =>
                        room && void agent.action(room, run.id, "approve")
                      }
                    >
                      Aprobar lote
                    </button>
                    <button
                      disabled={!editable}
                      onClick={() =>
                        room && void agent.action(room, run.id, "reject")
                      }
                    >
                      Rechazar
                    </button>
                  </>
                )}
                {["queued", "running"].includes(run.status) && (
                  <button
                    disabled={
                      !editable ||
                      (user?.id !== run.user_id && role !== "OWNER")
                    }
                    onClick={() =>
                      room && void agent.action(room, run.id, "cancel")
                    }
                  >
                    Cancelar tarea
                  </button>
                )}
                {["failed", "stale", "cancelled"].includes(run.status) &&
                  user?.id === run.user_id && (
                    <button
                      disabled={!editable}
                      onClick={() =>
                        room && void agent.action(room, run.id, "retry")
                      }
                    >
                      Volver a proponer
                    </button>
                  )}
                {run.status === "completed" &&
                  run.commands.length > 0 &&
                  user?.id === run.user_id &&
                  !run.undone && (
                    <button
                      disabled={!editable}
                      onClick={() =>
                        room && void agent.action(room, run.id, "undo")
                      }
                    >
                      Deshacer mis cambios
                    </button>
                  )}
              </article>
            ))}
          </>
        )}
      </div>
      <form
        onSubmit={submit}
        onPaste={(event) => {
          for (const item of event.clipboardData.items)
            if (item.type.startsWith("image/")) {
              const blob = item.getAsFile();
              if (blob) attach(blob);
            }
        }}
      >
        <label htmlFor="agent-mode">Modo de esta tarea</label>
        <select
          id="agent-mode"
          value={agent.mode}
          onChange={(event) =>
            agent.setMode(event.target.value as "suggest" | "edit")
          }
          disabled={agent.submitting}
        >
          <option value="suggest">Sugerir · aprobar antes de aplicar</option>
          <option value="edit">Editar · aplicar cambios permitidos</option>
        </select>
        {agent.mode === "edit" && (
          <p>Las eliminaciones siempre requieren aprobación.</p>
        )}
        {image && (
          <div>
            <img
              className="agent-attachment"
              src={image}
              alt="Imagen adjunta"
            />
            <button type="button" onClick={() => setImage(undefined)}>
              Quitar imagen
            </button>
          </div>
        )}
        <textarea
          aria-label="Mensaje al agente"
          value={text}
          maxLength={4000}
          placeholder="Agrega una clase, revisa una relación u ordena el diagrama…"
          onChange={(event) => setText(event.target.value)}
          disabled={!editable || agent.submitting}
        />
        <div className="agent-compose-actions">
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const blob = event.target.files?.[0];
              if (blob) attach(blob);
            }}
          />
          <button
            type="button"
            disabled={!editable}
            onClick={() => file.current?.click()}
            aria-label="Adjuntar imagen"
          >
            <ImageIcon size={18} />
          </button>
          <button
            type="button"
            disabled={!editable || transcribing}
            onClick={() => void microphone()}
            aria-label={recording ? "Detener grabación" : "Dictar mensaje"}
          >
            <Mic size={18} />
            {recording ? "Detener" : transcribing ? "Transcribiendo…" : ""}
          </button>
          <button
            type="submit"
            disabled={!editable || agent.submitting || (!text.trim() && !image)}
          >
            <Send size={16} />
            {agent.submitting ? "Enviando…" : "Enviar"}
          </button>
        </div>
        {!editable && (
          <p>Conecta a la sala con permisos de edición para iniciar tareas.</p>
        )}
      </form>
    </aside>
  );
};
