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
      className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden transition-all text-sm font-sans"
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        is_valid
          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300'
          : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40 text-holst-900 dark:text-holst-300'
      }`}>
        <div className="flex items-center gap-2">
          {is_valid ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-500 dark:text-red-400" />
          )}
          <h3 className="font-semibold text-sm m-0">
            {is_valid ? 'Validación Exitosa' : 'Errores de Validación'}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de validación"
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {is_valid ? (
          <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="m-0 font-medium">El modelo UML es consistente y válido.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wider">
              <AlertCircle className="w-4 h-4" />
              <span>Se encontraron {errors.length} problemas:</span>
            </div>

            <ul className="space-y-2 m-0 p-0 list-none max-h-60 overflow-y-auto pr-1">
              {errors.map((err, i) => (
                <li
                  key={i}
                  className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs leading-relaxed"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-holst-900 dark:text-holst-300 bg-holst-100 dark:bg-holst-900/40 px-2 py-0.5 rounded text-[11px]">
                      {err.field}
                    </span>
                    {err.model_element_id && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        ID: {err.model_element_id}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 m-0 font-medium">
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
