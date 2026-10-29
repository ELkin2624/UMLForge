import React from 'react';
import { Sparkles, Bot } from 'lucide-react';
import { useAIAssistantStore } from '../model/ai-store';

export const AIPresenceIndicator: React.FC = () => {
  const aiPresence = useAIAssistantStore((s) => s.aiPresence);
  const isThinking = aiPresence.status === 'thinking';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 700,
        backgroundColor: isThinking ? '#fef08a' : '#f5f3ff',
        border: '2px solid #1a1a1a',
        boxShadow: '2px 2px 0 #1a1a1a',
        color: '#1a1a1a',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
      title={
        isThinking
          ? `Gemini Architect procesando consulta con ${aiPresence.consultingWith || 'un compañero'}`
          : 'Gemini IA está en línea, observando el lienzo y sincronizando la memoria compartida'
      }
    >
      {isThinking ? (
        <>
          <Sparkles size={14} className="animate-spin text-purple-700" style={{ animation: 'spin 2s linear infinite' }} />
          <span>
            Gemini asistiendo a{' '}
            <strong style={{ color: '#7c3aed' }}>{aiPresence.consultingWith || 'un usuario'}</strong>...
          </span>
        </>
      ) : (
        <>
          <Bot size={15} style={{ color: '#7c3aed' }} />
          <span>Gemini IA (En línea)</span>
        </>
      )}
    </div>
  );
};
