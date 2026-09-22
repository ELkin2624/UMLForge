import React from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, X, ShieldCheck } from 'lucide-react';

export interface E2EHeaderProps {
  success: boolean;
  projectName: string;
  durationSec: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

export const E2EHeader: React.FC<E2EHeaderProps> = ({
  success,
  projectName,
  durationSec,
  collapsed,
  onToggleCollapse,
  onClose,
}) => {
  return (
    <div
      onClick={onToggleCollapse}
      className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors select-none ${
        success
          ? 'bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100 border-b border-emerald-200 dark:border-emerald-900/40'
          : 'bg-red-50 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-900 dark:text-red-100 border-b border-red-200 dark:border-red-900/40'
      } ${collapsed ? 'border-b-0' : ''}`}
    >
      <div className="flex items-center gap-3">
        {success ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {success ? 'Validación E2E completada con éxito' : 'Validación E2E fallida'}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                success
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              {success ? '✓ Verified' : '● Runtime verification'}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Proyecto: <strong className="text-slate-700 dark:text-slate-200">{projectName}</strong> · Duración: <strong className="text-slate-700 dark:text-slate-200">{durationSec}s</strong>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          title={collapsed ? 'Expandir' : 'Colapsar'}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Cerrar panel"
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
