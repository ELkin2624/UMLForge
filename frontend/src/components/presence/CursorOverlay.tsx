import { usePresence } from '../../hooks/use-presence';
import { MousePointer2 } from 'lucide-react';
import type { ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';

interface CursorOverlayProps {
  editorRef?: React.RefObject<NativeApollonEditor | null>;
}

export function CursorOverlay({ editorRef }: CursorOverlayProps) {
  const { peers, localClientId } = usePresence();
  
  // Filtrar peers remotos que tengan coordenadas de cursor
  const remotePeers = peers.filter(p => p.cursor && p.clientId !== localClientId); 

  if (remotePeers.length === 0) return null;

  return (
    <div
      className="cursor-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {remotePeers.map(peer => {
        const cursor = peer.cursor!;
        
        let screenX = cursor.x;
        let screenY = cursor.y;

        if (editorRef?.current) {
          try {
            const screenPos = editorRef.current.flowToScreenPosition(cursor);
            if (screenPos) {
              const container = document.querySelector('.case-editor');
              if (container) {
                const rect = container.getBoundingClientRect();
                screenX = screenPos.x - rect.left;
                screenY = screenPos.y - rect.top;
              } else {
                screenX = screenPos.x;
                screenY = screenPos.y;
              }
            }
          } catch {
            // Si el editor aún está calculando viewport, usar coordenadas directas
          }
        }

        return (
          <div
            key={peer.clientId}
            className="remote-cursor"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translate3d(${Math.round(screenX)}px, ${Math.round(screenY)}px, 0)`,
              willChange: 'transform',
              transition: 'transform 0.06s cubic-bezier(0, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              pointerEvents: 'none',
            }}
          >
            <MousePointer2 size={16} fill={peer.color} color={peer.color} />
            <div
              style={{
                backgroundColor: peer.color,
                color: '#fff',
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                marginTop: '2px',
                marginLeft: '8px',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                userSelect: 'none',
              }}
            >
              {peer.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
