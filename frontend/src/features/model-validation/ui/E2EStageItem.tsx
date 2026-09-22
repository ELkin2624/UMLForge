import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Terminal } from 'lucide-react';
import { StageResult } from '../../../types/api-responses';
import { getStageDisplayName, formatDurationSeconds } from '../model/stage-utils';

export interface E2EStageItemProps {
  stage: StageResult;
}

export const E2EStageItem: React.FC<E2EStageItemProps> = ({ stage }) => {
  const displayName = getStageDisplayName(stage.name);
  const stageDurSec = formatDurationSeconds(stage.duration_ms);

  const renderStatusIcon = (status: StageResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
      case 'failure':
        return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'skipped':
        return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700/70 rounded-md p-2.5 bg-white dark:bg-slate-800/80 transition-colors">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {renderStatusIcon(stage.status)}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{displayName}</span>
          {stage.error && (
            <span className="text-red-500 text-[11px] font-medium">— {stage.error}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-mono text-[11px]">
          <Clock className="w-3 h-3" />
          <span>{stageDurSec}s</span>
        </div>
      </div>

      {stage.logs && stage.logs.trim().length > 0 && (
        <details className="mt-2 text-xs group">
          <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium select-none flex items-center gap-1.5 transition-colors">
            <Terminal className="w-3 h-3 text-slate-400 group-open:text-holst-600" />
            <span>Ver logs de ejecución</span>
          </summary>
          <pre className="mt-1.5 p-2.5 bg-slate-900 dark:bg-slate-950 text-slate-200 rounded border border-slate-800 text-[11px] font-mono max-h-36 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed shadow-inner">
            {stage.logs}
          </pre>
        </details>
      )}
    </div>
  );
};
