import { request } from '@/shared/api/client';
import type { UMLModel } from '@/types/canonical-model';
import type { ValidationResult } from '@/types/api';

import { toBackendModel } from './backend-dto';

export const validateModel = (model: UMLModel) =>
  request<ValidationResult>('/models/validate', {
    method: 'POST',
    body: JSON.stringify(toBackendModel(model)),
  });
