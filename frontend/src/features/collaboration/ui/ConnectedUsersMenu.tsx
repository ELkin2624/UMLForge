import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, Users, X } from 'lucide-react';
import { useCollaboration } from '../model/use-collaboration';
import { usePresence } from '../model/use-presence';
import './ConnectedUsersMenu.css';

/** Lista de presencia del Y.Doc activo, accesible desde la barra superior. */
export function ConnectedUsersMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { status, error, roomNameWarning, clearWarning } = useCollaboration();
  const { peers, peersCount, localClientId } = usePresence();
  const connected = status === 'connected' || status === 'synced';
  const people = connected ? peers.filter((peer) => !peer.isAgent) : [];
  const agents = connected ? peers.filter((peer) => peer.isAgent) : [];
  const count = connected ? peersCount : 0;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="connected-users" ref={containerRef}>
      <button
        className={`connected-users__trigger${status === 'error' ? ' connected-users__trigger--error' : ''}`}
        type="button"
        aria-label={`Personas conectadas: ${count}`}
        aria-expanded={open}
        aria-controls="connected-users-list"
        onClick={() => setOpen((value) => !value)}
      >
        <Users size={17} aria-hidden="true" />
        <span>{count}</span>
      </button>

      {open && (
        <div className="connected-users__popover" id="connected-users-list" role="region" aria-label="Personas en la sala">
          <strong>En esta sala · {count}</strong>
          <p className="connected-users__status">{status === 'synced' ? 'Sincronizado en tiempo real' : status === 'connected' ? 'Sincronizando…' : status === 'connecting' ? 'Conectando…' : status === 'error' ? 'Error de conexión' : 'Sin conexión'}</p>
          {error && <p className="connected-users__error" role="alert"><AlertCircle size={14} />{error}</p>}
          {roomNameWarning && (
            <div className="connected-users__warning" role="alert">
              <span>{roomNameWarning}</span>
              <button type="button" onClick={clearWarning} aria-label="Cerrar aviso"><X size={14} /></button>
            </div>
          )}
          {connected && people.length === 0 && <p>Aún no hay personas conectadas.</p>}
          {people.map((peer) => (
            <div className="connected-users__person" key={peer.clientId}>
              <span className="connected-users__avatar" style={{ backgroundColor: peer.color }} aria-hidden="true">
                {peer.name.charAt(0).toUpperCase()}
              </span>
              <span className="connected-users__name">{peer.name}</span>
              {peer.clientId === localClientId && <small>Tú</small>}
            </div>
          ))}
          {agents.map((peer) => (
            <div className="connected-users__person" key={peer.clientId}>
              <span className="connected-users__avatar connected-users__avatar--agent" aria-hidden="true"><Bot size={15} /></span>
              <span className="connected-users__name">{peer.name}</span>
              <small>IA</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
