import React from 'react';
import { CheckCircle2, XCircle, X, Server, Clock, Database, Flame, AlertCircle } from 'lucide-react';
import { DeploymentResult } from '../../../types/api-responses';

export interface DeploymentResultPanelProps {
  result: DeploymentResult | null;
  onClose: () => void;
}

export const DeploymentResultPanel: React.FC<DeploymentResultPanelProps> = ({ result, onClose }) => {
  if (!result) return null;

  const { success, error, duration_ms, postgres_status, spring_boot_status, test_summary } = result;

  return (
    <div
      role="region"
      aria-label="Panel de resultados de despliegue"
      style={{
        backgroundColor: '#ffffff',
        border: '2px solid #1a1a1a',
        borderRadius: '14px',
        boxShadow: '4px 4px 0 #1a1a1a',
        overflow: 'hidden',
        fontFamily: "var(--sans, 'Inter', system-ui, sans-serif)",
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: success ? '#86efac' : '#fee2e2',
          borderBottom: '2px solid #1a1a1a',
          color: '#1a1a1a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {success ? (
            <CheckCircle2 size={20} style={{ color: '#166534' }} />
          ) : (
            <XCircle size={20} style={{ color: '#dc2626' }} />
          )}
          <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: '#1a1a1a' }}>
            {success ? 'Despliegue Exitoso' : 'Fallo en Despliegue'}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de despliegue"
          style={{
            background: '#ffffff',
            border: '1.5px solid #1a1a1a',
            borderRadius: '6px',
            boxShadow: '1.5px 1.5px 0 #1a1a1a',
            padding: '3px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1a1a1a',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '14px', backgroundColor: '#fafaf9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          <span style={{ fontWeight: 700, color: '#1a1a1a' }}>
            Estado: <strong style={{ color: success ? '#166534' : '#dc2626' }}>{success ? 'Completado' : 'Falló'}</strong>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
            <Clock size={13} />
            <span>{duration_ms} ms</span>
          </div>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1.5px solid #1a1a1a',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Services Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Server size={13} /> Servicios
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #1a1a1a', backgroundColor: '#ffffff', boxShadow: '2px 2px 0 #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700 }}>
                <Database size={13} /> PostgreSQL
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '5px',
                  border: '1px solid #1a1a1a',
                  backgroundColor: postgres_status?.status === 'up' ? '#86efac' : '#fee2e2',
                  color: postgres_status?.status === 'up' ? '#166534' : '#991b1b',
                }}
              >
                {postgres_status?.status === 'up' ? 'UP' : 'DOWN'}
              </span>
            </div>

            <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #1a1a1a', backgroundColor: '#ffffff', boxShadow: '2px 2px 0 #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700 }}>
                <Flame size={13} style={{ color: '#ea580c' }} /> Spring Boot
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '5px',
                  border: '1px solid #1a1a1a',
                  backgroundColor: spring_boot_status?.status === 'up' ? '#86efac' : '#fee2e2',
                  color: spring_boot_status?.status === 'up' ? '#166534' : '#991b1b',
                }}
              >
                {spring_boot_status?.status === 'up' ? 'UP' : 'DOWN'}
              </span>
            </div>
          </div>
        </div>

        {/* Newman Tests */}
        {test_summary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase' }}>
              Pruebas Newman
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
              <div style={{ padding: '6px', borderRadius: '6px', border: '1px solid #1a1a1a', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700 }}>Total</div>
                <div style={{ fontSize: '12px', fontWeight: 800 }}>{test_summary.total}</div>
              </div>
              <div style={{ padding: '6px', borderRadius: '6px', border: '1px solid #1a1a1a', backgroundColor: '#dcfce7' }}>
                <div style={{ fontSize: '9.5px', color: '#166534', fontWeight: 700 }}>OK</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534' }}>{test_summary.passed}</div>
              </div>
              <div style={{ padding: '6px', borderRadius: '6px', border: '1px solid #1a1a1a', backgroundColor: '#fee2e2' }}>
                <div style={{ fontSize: '9.5px', color: '#991b1b', fontWeight: 700 }}>Fail</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b' }}>{test_summary.failed}</div>
              </div>
              <div style={{ padding: '6px', borderRadius: '6px', border: '1px solid #1a1a1a', backgroundColor: '#fef08a' }}>
                <div style={{ fontSize: '9.5px', color: '#1a1a1a', fontWeight: 700 }}>Skip</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#1a1a1a' }}>{test_summary.skipped}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
