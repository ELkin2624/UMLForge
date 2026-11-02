import React from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useVersioningStore } from '../model/versioning-store';

/** Indicador del autoguardado (guardando / guardado / error). */
export const SaveStatus: React.FC = () => {
  const saveState = useVersioningStore((s) => s.saveState);
  const saveError = useVersioningStore((s) => s.saveError);

  if (saveState === 'idle') return null;

  const map = {
    saving: { icon: <Loader2 size={13} className="status-spinner" />, text: 'Guardando…', cls: 'loading' },
    saved: { icon: <Check size={13} />, text: 'Guardado', cls: 'success' },
    error: { icon: <AlertCircle size={13} />, text: 'Error al guardar', cls: 'error' },
  } as const;
  const item = map[saveState];

  return (
    <div
      className={`status-pill status-pill--${item.cls}`}
      title={saveError ?? 'Los cambios se guardan automáticamente'}
      role="status"
      aria-live="polite"
    >
      {item.icon}
      <span className="status-pill-text">{item.text}</span>
    </div>
  );
};
