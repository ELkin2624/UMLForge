import { useEffect, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import { useAIAssistantStore } from '../model/ai-store';
import './AICursor.css';

/** Representa la actividad real del agente, sin controlar el puntero del usuario. */
export function AICursor() {
  const presence = useAIAssistantStore((state) => state.aiPresence);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (presence.status !== 'editing_canvas' || !presence.targetId || !presence.expiresAt) {
      setPosition(null);
      return;
    }
    const update = () => {
      if (Date.now() >= presence.expiresAt!) {
        setPosition(null);
        return;
      }
      const container = document.querySelector('.case-editor');
      const element = container?.querySelector(`[data-id="${CSS.escape(presence.targetId!)}"]`);
      if (!container || !element) return;
      const parent = container.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      setPosition({ x: rect.left - parent.left + rect.width / 2, y: rect.top - parent.top + 12 });
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [presence]);

  if (!position) return null;
  return (
    <div className="ai-cursor" aria-label="Agente IA editando el diagrama"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
      <MousePointer2 size={22} fill="currentColor" />
      <span>IA editando</span>
    </div>
  );
}
