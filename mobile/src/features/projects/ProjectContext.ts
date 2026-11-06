import { createContext, useContext } from 'react';

import type { AsyncState } from '@/shared/useAsync';
import type { DiagramDetail } from '@/types/api';

export interface ProjectContextValue extends AsyncState<DiagramDetail> {
  id: string;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectContext.Provider');
  }
  return ctx;
}
