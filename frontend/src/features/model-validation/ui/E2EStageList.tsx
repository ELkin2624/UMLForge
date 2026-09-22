import React from 'react';
import { StageResult } from '../../../types/api-responses';
import { E2EStageItem } from './E2EStageItem';

export interface E2EStageListProps {
  stages: StageResult[];
}

export const E2EStageList: React.FC<E2EStageListProps> = ({ stages }) => {
  if (!stages || stages.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
        Etapas del Pipeline E2E ({stages.length})
      </div>
      {stages.map((stage, idx) => (
        <E2EStageItem key={`${stage.name}-${idx}`} stage={stage} />
      ))}
    </div>
  );
};
