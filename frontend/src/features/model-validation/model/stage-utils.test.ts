import { describe, it, expect } from 'vitest';
import { getStageDisplayName, formatDurationSeconds, STAGE_NAME_MAP } from './stage-utils';

describe('model-validation stage-utils', () => {
  it('should return correct display names for known pipeline stages', () => {
    expect(getStageDisplayName('validation')).toBe('Validación');
    expect(getStageDisplayName('generation')).toBe('Generación');
    expect(getStageDisplayName('postgres')).toBe('PostgreSQL');
    expect(getStageDisplayName('spring')).toBe('Spring Boot');
    expect(getStageDisplayName('newman')).toBe('Newman');
  });

  it('should fallback to stage key when stage is not in dictionary', () => {
    expect(getStageDisplayName('custom-docker-step')).toBe('custom-docker-step');
    expect(getStageDisplayName('lint')).toBe('lint');
  });

  it('should format duration from milliseconds to seconds with 2 decimals', () => {
    expect(formatDurationSeconds(1250)).toBe('1.25');
    expect(formatDurationSeconds(500)).toBe('0.50');
    expect(formatDurationSeconds(0)).toBe('0.00');
    expect(formatDurationSeconds(10000)).toBe('10.00');
  });

  it('should contain all expected stages in STAGE_NAME_MAP', () => {
    const keys = Object.keys(STAGE_NAME_MAP);
    expect(keys).toContain('validation');
    expect(keys).toContain('generation');
    expect(keys).toContain('extraction');
    expect(keys).toContain('postgres');
    expect(keys).toContain('maven');
    expect(keys).toContain('spring');
    expect(keys).toContain('health');
    expect(keys).toContain('newman');
  });
});
