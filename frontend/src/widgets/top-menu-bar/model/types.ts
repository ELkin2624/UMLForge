import { ValidationResult, DeploymentResult } from '../../../types/api-responses';

export type ActiveMenuType = 'file' | 'validate' | 'deploy' | 'share' | null;

export type GenState = 'READY' | 'VALIDATING' | 'GENERATING' | 'SUCCESS' | 'ERROR';

export interface TopMenuBarProps {
  onValidation: (res: ValidationResult | null) => void;
  onDeploy: (res: DeploymentResult | null) => void;
  onError: (err: string | null) => void;
}

export interface ModelStats {
  classCount: number;
  attrCount: number;
  opCount: number;
  relCount: number;
}
