import React from 'react';
import { TestSummary } from '../../../types/api-responses';

export interface E2EAssertionStatsProps {
  summary: TestSummary | null | undefined;
}

export const E2EAssertionStats: React.FC<E2EAssertionStatsProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-4 items-center bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-lg p-2.5 mb-3 divide-x divide-slate-200 dark:divide-slate-700">
      <div className="text-center px-2">
        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
          Assertions
        </div>
        <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
          {summary.total}
        </div>
      </div>

      <div className="text-center px-2">
        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold tracking-wider">
          Passed
        </div>
        <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
          {summary.passed}
        </div>
      </div>

      <div className="text-center px-2">
        <div className="text-[10px] text-red-600 dark:text-red-400 uppercase font-semibold tracking-wider">
          Failed
        </div>
        <div className="text-base font-bold text-red-600 dark:text-red-400 font-mono">
          {summary.failed}
        </div>
      </div>

      <div className="text-center px-2">
        <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold tracking-wider">
          Skipped
        </div>
        <div className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
          {summary.skipped}
        </div>
      </div>
    </div>
  );
};
