import { request } from '../../api/client';
import type { UMLModel } from '../../types/canonical-model';

export type SqlMode = 'schema' | 'data' | 'both';

export function generateSql(model: UMLModel, mode: SqlMode, rows: number): Promise<Blob> {
  return request<Blob>('/models/generate-sql', {
    method: 'POST',
    body: JSON.stringify({ model_data: model, mode, rows_per_entity: rows }),
  }, 'blob');
}
