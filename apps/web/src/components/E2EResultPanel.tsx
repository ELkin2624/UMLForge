import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { E2EResult, StageResult } from '../types/api-responses';

interface E2EResultPanelProps {
  result: E2EResult | null;
  onClose: () => void;
}

const STAGE_NAME_MAP: Record<string, string> = {
  validation: 'Validación',
  generation: 'Generación',
  extraction: 'Extracción',
  postgres: 'PostgreSQL',
  maven: 'Maven',
  spring: 'Spring Boot',
  health: 'Health Check',
  newman: 'Newman',
};

export const E2EResultPanel: React.FC<E2EResultPanelProps> = ({ result, onClose }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!result) {
    return null;
  }

  const { success, project_name, total_duration_ms, stages, test_summary } = result;
  const durationSec = (total_duration_ms / 1000).toFixed(2);

  const renderStatusIcon = (status: StageResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={16} color="#10b981" />;
      case 'failure':
        return <XCircle size={16} color="#ef4444" />;
      case 'skipped':
        return <AlertTriangle size={16} color="#f59e0b" />;
      default:
        return null;
    }
  };

  return (
    <div
      role="region"
      aria-label="Panel de resultados E2E"
      className="case-result-panel"
      style={{
        backgroundColor: '#ffffff',
        borderTop: success ? '2px solid #10b981' : '2px solid #ef4444',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.08)',
        maxHeight: '280px',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
      }}
    >

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          backgroundColor: success ? '#ecfdf5' : '#fef2f2',
          borderBottom: collapsed ? 'none' : '1px solid #e5e7eb',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {success ? <CheckCircle2 size={20} color="#059669" /> : <XCircle size={20} color="#dc2626" />}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: success ? '#065f46' : '#991b1b', fontSize: '14px' }}>
                {success ? 'Validación E2E completada con éxito' : 'Validación E2E fallida'}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: success ? '#d1fae5' : '#fee2e2',
                  color: success ? '#047857' : '#b91c1c',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                <ShieldCheck size={12} />
                {success ? '✓ Verified' : '● Runtime verification'}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              Proyecto: <strong>{project_name}</strong> · Duración: <strong>{durationSec}s</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(!collapsed);
            }}
            title={collapsed ? 'Expandir' : 'Colapsar'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Cerrar panel"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body content */}
      {!collapsed && (
        <div style={{ padding: '14px 16px', maxHeight: '350px', overflowY: 'auto' }}>
          {/* Test Summary Banner */}
          {test_summary && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '14px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Assertions
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  {test_summary.total}
                </div>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#059669', textTransform: 'uppercase', fontWeight: 600 }}>
                  Passed
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>
                  {test_summary.passed}
                </div>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#dc2626', textTransform: 'uppercase', fontWeight: 600 }}>
                  Failed
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                  {test_summary.failed}
                </div>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#d97706', textTransform: 'uppercase', fontWeight: 600 }}>
                  Skipped
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#d97706' }}>
                  {test_summary.skipped}
                </div>
              </div>
            </div>
          )}

          {/* Stages List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
              Etapas del Pipeline E2E ({stages.length})
            </div>
            {stages.map((stage, idx) => {
              const displayName = STAGE_NAME_MAP[stage.name] || stage.name;
              const stageDurSec = (stage.duration_ms / 1000).toFixed(2);

              return (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {renderStatusIcon(stage.status)}
                      <span style={{ fontWeight: 500, color: '#1e293b' }}>{displayName}</span>
                      {stage.error && (
                        <span style={{ color: '#dc2626', fontSize: '12px' }}>— {stage.error}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '12px' }}>
                      <Clock size={12} />
                      <span>{stageDurSec}s</span>
                    </div>
                  </div>

                  {/* Expandable Logs (collapsed by default) */}
                  {stage.logs && stage.logs.trim().length > 0 && (
                    <details style={{ marginTop: '6px' }}>
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: '#475569',
                          fontWeight: 500,
                          userSelect: 'none',
                        }}
                      >
                        Ver logs
                      </summary>
                      <pre
                        style={{
                          margin: '6px 0 0 0',
                          padding: '8px 10px',
                          backgroundColor: '#0f172a',
                          color: '#e2e8f0',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          maxHeight: '150px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {stage.logs}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
