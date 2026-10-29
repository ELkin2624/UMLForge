import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface NotificationProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ type, message, onClose }) => {
  const variantStyles = {
    success: {
      bg: '#dcfce7',
      text: '#166534',
      icon: <CheckCircle2 size={18} style={{ color: '#166534', flexShrink: 0 }} />,
    },
    error: {
      bg: '#fee2e2',
      text: '#991b1b',
      icon: <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />,
    },
    info: {
      bg: '#fef08a',
      text: '#1a1a1a',
      icon: <Info size={18} style={{ color: '#1a1a1a', flexShrink: 0 }} />,
    },
  };

  const current = variantStyles[type] || variantStyles.info;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: '12px',
        backgroundColor: current.bg,
        border: '2px solid #1a1a1a',
        boxShadow: '3px 3px 0 #1a1a1a',
        color: current.text,
        fontSize: '13px',
        fontWeight: 700,
        fontFamily: "var(--sans, 'Inter', system-ui, sans-serif)",
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '8px' }}>
        {current.icon}
        <span style={{ lineHeight: 1.3 }}>{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          style={{
            background: '#ffffff',
            border: '1.5px solid #1a1a1a',
            borderRadius: '6px',
            boxShadow: '1px 1px 0 #1a1a1a',
            padding: '2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1a1a1a',
            flexShrink: 0,
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};
