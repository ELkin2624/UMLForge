import React, { useState } from 'react';
import { E2EResult } from '../../../types/api-responses';
import { formatDurationSeconds } from '../model/stage-utils';
import { E2EHeader } from './E2EHeader';
import { E2EAssertionStats } from './E2EAssertionStats';
import { E2EStageList } from './E2EStageList';

export interface E2EResultPanelProps {
  result: E2EResult | null;
  onClose: () => void;
}

export const E2EResultPanel: React.FC<E2EResultPanelProps> = ({ result, onClose }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!result) {
    return null;
  }

  const { success, project_name, total_duration_ms, stages, test_summary } = result;
  const durationSec = formatDurationSeconds(total_duration_ms);

  return (
    <div
      role="region"
      aria-label="Panel de resultados E2E"
      className={`case-result-panel bg-white dark:bg-slate-900 border-t-2 shadow-2xl transition-all ${
        success ? 'border-t-emerald-500' : 'border-t-red-500'
      }`}
    >
      <E2EHeader
        success={success}
        projectName={project_name}
        durationSec={durationSec}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onClose={onClose}
      />

      {!collapsed && (
        <div className="p-4 max-h-[220px] overflow-y-auto">
          <E2EAssertionStats summary={test_summary} />
          <E2EStageList stages={stages} />
        </div>
      )}
    </div>
  );
};
