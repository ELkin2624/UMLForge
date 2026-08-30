import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useModelStore } from '../store/model-store';

export const LoadingOverlay: React.FC = () => {
  const { e2eState, e2eStartedAt } = useModelStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (e2eState !== 'running') {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      if (e2eStartedAt) {
        const seconds = Math.floor((Date.now() - e2eStartedAt) / 1000);
        setElapsedSeconds(seconds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [e2eState, e2eStartedAt]);

  if (e2eState !== 'running') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          padding: '28px 36px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          border: '1px solid #334155',
          maxWidth: '420px',
          textAlign: 'center',
        }}
      >
        <Loader2
          size={44}
          color="#38bdf8"
          style={{ animation: 'spin 1s linear infinite' }}
        />
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
            Ejecutando validación E2E...
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Esto puede tardar hasta 60 segundos
          </p>
        </div>

        <div
          style={{
            marginTop: '4px',
            backgroundColor: '#0f172a',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            color: '#38bdf8',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 500,
            border: '1px solid #1e293b',
          }}
        >
          Tiempo transcurrido: {elapsedSeconds} s
        </div>

        <div style={{ fontSize: '11px', color: '#64748b' }}>
          Validación · Generación · PostgreSQL · Maven · Spring Boot · Newman
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
