import { useEffect, useRef, useState } from 'react';
import { usePresence } from '../model/use-presence';

interface Toast {
  id: string;
  message: string;
  color: string;
  type: 'join' | 'leave';
}

export function PresenceToasts() {
  const { peers } = usePresence();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const previousPeersRef = useRef(peers);

  useEffect(() => {
    const prev = previousPeersRef.current;
    const curr = peers;

    // Ignorar montaje inicial cuando no había peers previos
    if (prev.length === 0 && curr.length > 0) {
      previousPeersRef.current = curr;
      return;
    }

    // Identificar unidos
    const joined = curr.filter((p) => !prev.find((old) => old.clientId === p.clientId));
    // Identificar desconectados
    const left = prev.filter((old) => !curr.find((p) => p.clientId === old.clientId));

    const newToasts: Toast[] = [];

    joined.forEach((p) => {
      newToasts.push({
        id: `join-${p.clientId}-${Date.now()}`,
        message: `${p.name} se ha unido`,
        color: p.color,
        type: 'join',
      });
    });

    left.forEach((p) => {
      newToasts.push({
        id: `leave-${p.clientId}-${Date.now()}`,
        message: `${p.name} salió de la sala`,
        color: p.color,
        type: 'leave',
      });
    });

    if (newToasts.length > 0) {
      setToasts((current) => [...current, ...newToasts]);
    }

    previousPeersRef.current = curr;
  }, [peers]);

  // Limpieza automática de toasts tras 3 segundos
  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 3000);

    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="presence-toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className="presence-toast">
          <span
            className="presence-toast__dot"
            style={{ backgroundColor: toast.color }}
          />
          <span className="presence-toast__message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
