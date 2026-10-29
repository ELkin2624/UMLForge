import React, { useEffect } from 'react';
import { History, RefreshCw, User, Bot } from 'lucide-react';
import { useAIAssistantStore } from '../model/ai-store';
import { useShareStore } from '../../sharing/model/share-store';

export const AuditFeedTab: React.FC = () => {
  const auditFeed = useAIAssistantStore((s) => s.auditFeed);
  const loadAuditFeed = useAIAssistantStore((s) => s.loadAuditFeed);
  const roomId = useShareStore((s) => s.roomId) || 'default-room';

  useEffect(() => {
    loadAuditFeed(roomId);
  }, [roomId, loadAuditFeed]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#fafaf9' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '2px solid #1a1a1a',
          backgroundColor: '#ffffff',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <History size={15} /> Muro de Auditoría del Equipo
        </span>
        <button
          onClick={() => loadAuditFeed(roomId)}
          style={{
            background: '#ffffff',
            border: '1.5px solid #1a1a1a',
            borderRadius: '6px',
            boxShadow: '1.5px 1.5px 0 #1a1a1a',
            color: '#1a1a1a',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Refrescar auditoría"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {auditFeed.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', marginTop: '30px' }}>
            No hay registros de auditoría aún para este diagrama.
          </div>
        ) : (
          auditFeed.map((entry, idx) => {
            const isAI = entry.actor.toLowerCase().includes('ia') || entry.actor.toLowerCase().includes('gemini');
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                  padding: '9px 10px',
                  borderRadius: '10px',
                  backgroundColor: isAI ? '#faf5ff' : '#ffffff',
                  border: '2px solid #1a1a1a',
                  boxShadow: '2px 2px 0 #1a1a1a',
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '8px',
                    backgroundColor: isAI ? '#f7d273' : '#e0e7ff',
                    border: '1.5px solid #1a1a1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1a1a1a',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  {isAI ? <Bot size={14} /> : <User size={14} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#1a1a1a' }}>
                      {entry.actor}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b' }}>
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#334155', lineHeight: '1.4', wordBreak: 'break-word' }}>
                    {entry.action_summary}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
