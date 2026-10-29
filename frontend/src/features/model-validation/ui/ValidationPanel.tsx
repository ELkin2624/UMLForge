import React from 'react';
import { CheckCircle2, AlertCircle, X, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ValidationResult } from '../../../types/api-responses';

export interface ValidationPanelProps {
  result: ValidationResult | null;
  onClose: () => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ result, onClose }) => {
  if (!result) return null;

  const { is_valid, errors = [] } = result;

  return (
    <div
      role="region"
      aria-label="Panel de resultados de validación"
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
      {/* Header en estilo Bauhaus */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: is_valid ? '#86efac' : '#fee2e2',
          borderBottom: '2px solid #1a1a1a',
          color: '#1a1a1a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {is_valid ? (
            <ShieldCheck size={20} style={{ color: '#166534' }} />
          ) : (
            <ShieldAlert size={20} style={{ color: '#dc2626' }} />
          )}
          <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: '#1a1a1a' }}>
            {is_valid ? 'Validación Exitosa' : 'Errores de Validación'}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de validación"
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
            transition: 'all 0.15s ease',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '14px', backgroundColor: '#fafaf9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {is_valid ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '2px solid #1a1a1a',
              backgroundColor: '#dcfce7',
              boxShadow: '2px 2px 0 #1a1a1a',
              color: '#166534',
              fontSize: '12.5px',
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0 }}>El modelo UML es consistente y válido.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#dc2626',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <AlertCircle size={15} />
              <span>Se encontraron {errors.length} problemas:</span>
            </div>

            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                maxHeight: '220px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {errors.map((err, i) => (
                <li
                  key={i}
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1.5px solid #1a1a1a',
                    boxShadow: '2px 2px 0 #1a1a1a',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontWeight: 800,
                        backgroundColor: '#fef08a',
                        border: '1px solid #1a1a1a',
                        padding: '1px 6px',
                        borderRadius: '5px',
                        fontSize: '10.5px',
                        color: '#1a1a1a',
                      }}
                    >
                      {err.field}
                    </span>
                    {err.model_element_id && (
                      <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                        ID: {err.model_element_id}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, color: '#334155', fontWeight: 600, lineHeight: 1.4 }}>
                    {err.message}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
