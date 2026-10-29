import React from 'react';
import { Check, X, Sparkles, Layers } from 'lucide-react';
import { useAIAssistantStore } from '../model/ai-store';
import { useAuthStore } from '../../auth/store';
import { useShareStore } from '../../sharing/model/share-store';
import { getSharedCollaborationManager } from '../../collaboration';

export const AISuggestionsOverlay: React.FC = () => {
  const suggestions = useAIAssistantStore((s) => s.suggestions);
  const approvePatch = useAIAssistantStore((s) => s.approvePatch);
  const rejectPatch = useAIAssistantStore((s) => s.rejectPatch);

  const roomId = useShareStore((s) => s.roomId) || 'default-room';
  const currentUser = useAuthStore((s) => s.user);
  const userName = currentUser?.display_name || currentUser?.username || 'Usuario';

  const patchList = Object.values(suggestions);

  if (patchList.length === 0) {
    return null;
  }

  const manager = getSharedCollaborationManager();
  const ydoc = manager.getDoc();

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        maxWidth: '380px',
        maxHeight: '420px',
        backgroundColor: '#ffffff',
        border: '2px solid #1a1a1a',
        borderRadius: '14px',
        boxShadow: '4px 4px 0 #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 50,
        fontFamily: "var(--sans, 'Inter', system-ui, sans-serif)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--shape-yellow, #f7d273)',
          borderBottom: '2px solid #1a1a1a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: '#1a1a1a' }} />
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1a1a1a' }}>
            Sugerencias de la IA ({patchList.length})
          </span>
        </div>
        <span
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '2px 6px',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            border: '1.5px solid #1a1a1a',
            color: '#1a1a1a',
            fontWeight: 800,
          }}
        >
          Google Docs Mode
        </span>
      </div>

      {/* Lista de Sugerencias */}
      <div style={{ overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fafaf9' }}>
        {patchList.map((patch) => (
          <div
            key={patch.patch_id}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '2px solid #1a1a1a',
              backgroundColor: '#ffffff',
              boxShadow: '2px 2px 0 #1a1a1a',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} style={{ color: '#7c3aed' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1a1a1a' }}>
                  {patch.target}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '5px',
                    backgroundColor: '#fef08a',
                    border: '1px solid #1a1a1a',
                    color: '#1a1a1a',
                  }}
                >
                  {patch.operation}
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '11.5px', color: '#475569', lineHeight: '1.4' }}>
              {patch.reason}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '4px',
                paddingTop: '6px',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <span style={{ fontSize: '10.5px', color: '#7c3aed', fontWeight: 600 }}>
                Por <strong>{patch.requested_by}</strong>
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() =>
                    approvePatch({
                      diagramId: roomId,
                      patchId: patch.patch_id,
                      userName,
                      ydoc,
                    })
                  }
                  title="Aprobar cambio en el lienzo"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1.5px solid #1a1a1a',
                    backgroundColor: '#86efac',
                    color: '#1a1a1a',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '1.5px 1.5px 0 #1a1a1a',
                  }}
                >
                  <Check size={12} /> Aprobar
                </button>
                <button
                  onClick={() =>
                    rejectPatch({
                      diagramId: roomId,
                      patchId: patch.patch_id,
                      userName,
                      ydoc,
                    })
                  }
                  title="Rechazar cambio"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1.5px solid #1a1a1a',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '1.5px 1.5px 0 #1a1a1a',
                  }}
                >
                  <X size={12} /> Rechazar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
