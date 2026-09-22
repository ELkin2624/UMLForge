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
      container: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />,
      closeBtn: 'text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
    },
    error: {
      container: 'bg-red-50 dark:bg-red-950/80 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100',
      icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />,
      closeBtn: 'text-red-600 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/50',
    },
    info: {
      container: 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-holst-900 dark:text-holst-100',
      icon: <Info className="w-5 h-5 text-holst-600 dark:text-holst-400 flex-shrink-0" />,
      closeBtn: 'text-holst-600 hover:text-holst-800 dark:hover:text-holst-200 hover:bg-amber-100 dark:hover:bg-amber-900/50',
    },
  };

  const current = variantStyles[type] || variantStyles.info;

  return (
    <div
      role="alert"
      className={`flex items-center justify-between p-3.5 rounded-lg border shadow-md transition-all text-sm font-sans ${current.container}`}
    >
      <div className="flex items-center gap-2.5 mr-2">
        {current.icon}
        <span className="font-medium leading-tight">{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          className={`p-1 rounded-md transition-colors flex-shrink-0 ${current.closeBtn}`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
