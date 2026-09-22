import React, { useRef, useCallback } from 'react';
import { type ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';

interface UseCanvasAwarenessOptions {
  editorRef: React.RefObject<NativeApollonEditor | null>;
  status: string;
  setAwarenessState: (key: string, value: any) => void;
}

/**
 * Hook responsable del seguimiento del cursor en el lienzo del diagrama,
 * conversión de coordenadas pantalla -> lienzo y transmisión de awareness vía WebSockets.
 */
export function useCanvasAwareness({
  editorRef,
  status,
  setAwarenessState,
}: UseCanvasAwarenessOptions) {
  const lastMouseTimeRef = useRef(0);
  const clearCursorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (status !== 'connected' && status !== 'synced') return;
      if (!editorRef.current) return;

      if (clearCursorTimeoutRef.current) {
        clearTimeout(clearCursorTimeoutRef.current);
        clearCursorTimeoutRef.current = null;
      }

      const now = performance.now();
      // Throttle 30ms (~33 FPS) para movimiento suave de cursor sin saturar el WebSocket
      if (now - lastMouseTimeRef.current < 30) return;
      lastMouseTimeRef.current = now;

      try {
        const flowPos = editorRef.current.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        if (flowPos && Number.isFinite(flowPos.x) && Number.isFinite(flowPos.y)) {
          setAwarenessState('cursor', {
            x: Math.round(flowPos.x),
            y: Math.round(flowPos.y),
          });
        }
      } catch {
        // Ignorar si Apollon aún no ha terminado de montar sus capas internas
      }
    },
    [status, setAwarenessState, editorRef]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (status !== 'connected' && status !== 'synced') return;
      // relatedTarget puede ser SVGElement u otro no-Node: guard explícito.
      const related = e.relatedTarget;
      if (related instanceof Node && e.currentTarget.contains(related)) {
        return;
      }

      if (clearCursorTimeoutRef.current) clearTimeout(clearCursorTimeoutRef.current);
      clearCursorTimeoutRef.current = setTimeout(() => {
        setAwarenessState('cursor', null);
      }, 150);
    },
    [status, setAwarenessState]
  );

  return {
    handleMouseMove,
    handleMouseLeave,
  };
}
