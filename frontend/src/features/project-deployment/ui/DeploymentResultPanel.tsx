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
      className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden transition-all text-sm font-sans"
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        success
          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-100'
          : 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40 text-red-900 dark:text-red-100'
      }`}>
        <div className="flex items-center gap-2">
          {success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
          <h3 className="font-semibold text-sm m-0">
            {success ? 'Despliegue Exitoso' : 'Fallo en Despliegue'}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de despliegue"
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3.5">
        {/* Metric & Error */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Estado general: <strong className={success ? 'text-emerald-600' : 'text-red-600'}>{success ? 'Éxito' : 'Falló'}</strong></span>
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span>{duration_ms} ms</span>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg border border-red-200 dark:border-red-900/30">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Services Status */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Server className="w-3.5 h-3.5" />
            <span>Servicios</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <Database className="w-3.5 h-3.5 text-holst-700 dark:text-holst-300" />
                <span>PostgreSQL</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                postgres_status?.status === 'up'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              }`}>
                {postgres_status?.status === 'up' ? 'UP' : 'DOWN'}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>Spring Boot</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                spring_boot_status?.status === 'up'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              }`}>
                {spring_boot_status?.status === 'up' ? 'UP' : 'DOWN'}
              </span>
            </div>
          </div>
        </div>

        {/* Newman Tests */}
        {test_summary && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Pruebas Newman
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
              <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] text-slate-400 font-semibold">Total</div>
                <div className="font-bold text-slate-700 dark:text-slate-200 font-mono">{test_summary.total}</div>
              </div>
              <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/30">
                <div className="text-[10px] text-emerald-600 font-semibold">OK</div>
                <div className="font-bold text-emerald-600 font-mono">{test_summary.passed}</div>
              </div>
              <div className="p-1.5 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/30">
                <div className="text-[10px] text-red-600 font-semibold">Fail</div>
                <div className="font-bold text-red-600 font-mono">{test_summary.failed}</div>
              </div>
              <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30">
                <div className="text-[10px] text-amber-600 font-semibold">Skip</div>
                <div className="font-bold text-amber-600 font-mono">{test_summary.skipped}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
