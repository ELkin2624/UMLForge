import { request } from './client';
import { UMLModel } from '../types/canonical-model';

/**
 * Guarda el modelo canónico del diagrama en el backend.
 * @param roomId Identificador de la sala/diagrama
 * @param model Modelo UML a persistir
 */
export async function saveDiagram(roomId: string, model: UMLModel): Promise<void> {
  return request<void>(`/diagrams/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify({ data: model }),
  });
}
