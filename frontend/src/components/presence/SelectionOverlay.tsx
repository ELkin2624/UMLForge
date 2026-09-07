import { useEffect, useState } from 'react';
import { usePresence } from '../../hooks/use-presence';
import type { ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionOverlayProps {
  editorRef?: React.RefObject<NativeApollonEditor | null>;
}

export function SelectionOverlay({ editorRef: _editorRef }: SelectionOverlayProps) {
  const { peers, localClientId } = usePresence();
  const [boxes, setBoxes] = useState<Map<string, { box: BoundingBox; peer: any }>>(new Map());

  useEffect(() => {
    const remotePeers = peers.filter(p => p.selectedNode && p.clientId !== localClientId);

    if (remotePeers.length === 0) {
      setBoxes(prev => prev.size === 0 ? prev : new Map());
      return;
    }

    const computeBoxes = () => {
      const container = document.querySelector('.case-editor');
      const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
      const newBoxes = new Map<string, { box: BoundingBox; peer: any }>();

      remotePeers.forEach(peer => {
        if (!peer.selectedNode) return;
        
        const element = document.querySelector(`[data-id="${peer.selectedNode}"]`) as HTMLElement;
        if (element) {
          const rect = element.getBoundingClientRect();
          newBoxes.set(peer.clientId.toString(), {
            box: {
              x: rect.left - containerRect.left,
              y: rect.top - containerRect.top,
              width: rect.width,
              height: rect.height,
            },
            peer
          });
        }
      });

      setBoxes(newBoxes);
    };

    computeBoxes();

    window.addEventListener('resize', computeBoxes);
    return () => {
      window.removeEventListener('resize', computeBoxes);
    };
  }, [peers, localClientId]);

  if (boxes.size === 0) return null;

  return (
    <div
      className="selection-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 40,
        overflow: 'hidden',
      }}
    >
      {Array.from(boxes.values()).map(({ box, peer }) => (
        <div
          key={peer.clientId}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0)`,
            width: box.width,
            height: box.height,
            border: `2px solid ${peer.color}`,
            borderRadius: '4px',
            boxShadow: `0 0 10px ${peer.color}40`,
            transition: 'transform 0.08s ease-out, width 0.08s ease-out, height 0.08s ease-out',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-24px',
              left: '-2px',
              backgroundColor: peer.color,
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              userSelect: 'none',
            }}
          >
            {peer.name} está editando...
          </div>
        </div>
      ))}
    </div>
  );
}
