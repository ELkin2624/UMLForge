import { request } from '../../../api/client';

export interface DiagramCollaborator {
  user_id: number;
  username: string;
  display_name: string | null;
  role: string;
  is_pending: boolean;
}

/** Colaboradores e invitaciones pendientes de un diagrama (solo el propietario puede verlos). */
export function listCollaborators(diagramId: number | string): Promise<DiagramCollaborator[]> {
  return request<DiagramCollaborator[]>(`/diagrams/${diagramId}/collaborators`);
}
