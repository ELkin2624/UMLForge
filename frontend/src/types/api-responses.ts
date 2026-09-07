export interface ValidationError {
  model_element_id?: string;
  field: string;
  message: string;
  type?: string;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
}

export interface DeploymentResult {
  success: boolean;
  project_name: string;
  duration_ms: number;
  postgres_status: {
    name: string;
    status: string;
  };
  spring_boot_status: {
    name: string;
    status: string;
  };
  test_summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  } | null;
  error?: string | null;
  logs: {
    docker_up: string;
    maven: string;
    spring: string;
  };
}

export interface StageResult {
  name: string;
  status: 'success' | 'failure' | 'skipped';
  duration_ms: number;
  error?: string | null;
  logs?: string | null;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface E2EResult {
  success: boolean;
  project_name: string;
  total_duration_ms: number;
  stages: StageResult[];
  test_summary?: TestSummary | null;
  zip_path?: string | null;
  report_path?: string | null;
}

export type E2EUiState = 'idle' | 'running' | 'success' | 'failure';

