export const STAGE_NAME_MAP: Record<string, string> = {
  validation: 'Validación',
  generation: 'Generación',
  extraction: 'Extracción',
  postgres: 'PostgreSQL',
  maven: 'Maven',
  spring: 'Spring Boot',
  health: 'Health Check',
  newman: 'Newman',
};

export function getStageDisplayName(stageKey: string): string {
  return STAGE_NAME_MAP[stageKey] || stageKey;
}

export function formatDurationSeconds(ms: number): string {
  return (ms / 1000).toFixed(2);
}
