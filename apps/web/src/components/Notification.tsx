import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface NotificationProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ type, message, onClose }) => {
  const styles: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
    success: {
      bg: '#ecfdf5',
      border: '#6ee7b7',
      color: '#065f46',
      icon: <CheckCircle2 size={18} color="#059669" />,
    },
    error: {
      bg: '#fef2f2',
      border: '#fca5a5',
      color: '#991b1b',
      icon: <AlertCircle size={18} color="#dc2626" />,
    },
    info: {
      bg: '#eff6ff',
      border: '#93c5fd',
      color: '#1e40af',
      icon: <Info size={18} color="#2563eb" />,
    },
  };

  const current = styles[type] || styles.info;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        backgroundColor: current.bg,
        border: `1px solid ${current.border}`,
        borderRadius: '6px',
        color: current.color,
        fontSize: '14px',
        marginBottom: '10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {current.icon}
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Cerrar notificación"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            color: current.color,
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
