import { Bot } from "lucide-react";
import { useModelStore } from "../../../store/model-store";

const labels: Record<string, string> = {
  idle: "Disponible",
  thinking: "Pensando",
  pointing: "Señalando",
  proposing: "Preparando propuesta",
  applying: "Aplicando cambios",
  error: "Error en la última tarea",
};

export const AIPresenceIndicator = () => {
  const peers = useModelStore((s) => s.collaboration.peers);
  const agent = peers.find((peer) => peer.isAgent);
  return (
    <span className="agent-presence" role="status">
      <Bot size={16} />{" "}
      {agent
        ? `Agente · ${labels[agent.agent?.status ?? "idle"] ?? "Disponible"}`
        : "Agente desactivado o sin conexión"}
    </span>
  );
};
