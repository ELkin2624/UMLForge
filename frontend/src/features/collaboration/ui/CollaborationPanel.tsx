import { useState, useCallback } from 'react';
import {
  Users,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  X,
  Loader,
} from 'lucide-react';
import { useCollaboration } from '../model/use-collaboration';
import { usePresence } from '../model/use-presence';
import { StatusIcon } from './StatusIcon';
import type { CollaborationStatus } from '../model/types';

const STATUS_LABELS: Record<CollaborationStatus, string> = {
  idle: 'Inactivo',
  connecting: 'Conectando...',
  connected: 'Conectado',
  synced: 'Sincronizado',
  disconnected: 'Desconectado',
  error: 'Error',
};

function StatusLabel({ status }: { status: CollaborationStatus }) {
  return (
    <span
      className={`collab-panel__status-label collab-panel__status-label--${status}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Panel de colaboración flotante (posición fija inferior-izquierda).
 * No interfiere con el lienzo de Apollon ni con los paneles laterales.
 */
export function CollaborationPanel() {
  const [collapsed, setCollapsed] = useState(false);

  const {
    disconnect,
    status,
    roomName,
    peersCount,
    error,
    roomNameWarning,
    clearWarning,
  } = useCollaboration();

  const { peers } = usePresence();

  const isConnected = status === 'connected' || status === 'synced';
  const isConnecting = status === 'connecting';

  const handleDisconnect = useCallback(() => {
    disconnect();
    try {
      sessionStorage.removeItem('umlforge-collab-active');
    } catch {}
  }, [disconnect]);

  // Ocultar completamente el panel si no hay sesión activa o en proceso.
  if (status === 'idle' || status === 'disconnected') {
    return null;
  }

  return (
    <div
      className="collab-panel"
      role="complementary"
      aria-label="Panel de colaboración"
    >
      {/* Header siempre visible */}
      <div className="collab-panel__header">
        <div className="collab-panel__header-left">
          <StatusIcon status={status} />
          <span className="collab-panel__title">Colaboración</span>
          {isConnected && (
            <span
              className="collab-panel__peers-badge"
              title={`${peersCount} usuarios online (incluido tú)`}
            >
              <Users size={12} />
              {peersCount}
            </span>
          )}
        </div>
        <button
          className="collab-panel__toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir panel' : 'Colapsar panel'}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Cuerpo colapsable */}
      {!collapsed && (
        <div className="collab-panel__body">
          {/* Warning de reemplazo de modelo */}
          {roomNameWarning && (
            <div className="collab-panel__warning" role="alert">
              <AlertCircle size={13} />
              <span>{roomNameWarning}</span>
              <button
                className="collab-panel__warning-close"
                onClick={clearWarning}
                aria-label="Cerrar aviso"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="collab-panel__error" role="alert">
              <AlertCircle size={13} />
              <span>{error}</span>
            </div>
          )}

          {/* Estado y sala actuales */}
          {(isConnected || isConnecting) && (
            <div className="collab-panel__status-row">
              <StatusLabel status={status} />
              {roomName && (
                <span
                  className="collab-panel__room-name"
                  title={`Sala: ${roomName}`}
                >
                  {roomName}
                </span>
              )}
            </div>
          )}

          {/* Lista de peers (solo cuando hay conexión) */}
          {isConnected && peers.length > 0 && (
            <div className="collab-panel__peers">
              <span className="collab-panel__peers-title">
                {peersCount} usuario{peersCount !== 1 ? 's' : ''} online
              </span>
              <div
                className="collab-panel__avatars"
                aria-label="Usuarios conectados"
              >
                {peers.map((peer) => (
                  <div
                    key={peer.clientId}
                    className="collab-panel__avatar"
                    style={{ backgroundColor: peer.color }}
                    title={peer.name}
                  >
                    {peer.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón principal para desconectar sesión activa */}
          <button
            id="collab-connect-btn"
            className="collab-panel__btn collab-panel__btn--disconnect"
            onClick={handleDisconnect}
            disabled={isConnecting}
            aria-busy={isConnecting}
          >
            {isConnecting && (
              <Loader size={13} className="collab-panel__spinner" />
            )}
            <span>{isConnecting ? 'Conectando...' : 'Desconectar'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
