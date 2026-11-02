import { request } from '../../../api/client';

export type LinkRole = 'EDITOR' | 'READER';

/** Estado del enlace de acceso general. `token` solo llega al propietario. */
export interface ShareLink {
  enabled: boolean;
  role: LinkRole;
  token: string | null;
  updated_at?: string | null;
}

export interface JoinResult {
  diagram_id: number;
  diagram_name: string;
  role: string;
  already_member: boolean;
}

export function getShareLink(diagramId: string): Promise<ShareLink> {
  return request<ShareLink>(`/diagrams/${diagramId}/share-link`);
}

export function updateShareLink(
  diagramId: string,
  payload: { enabled: boolean; role: LinkRole }
): Promise<ShareLink> {
  return request<ShareLink>(`/diagrams/${diagramId}/share-link`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function regenerateShareLink(diagramId: string): Promise<ShareLink> {
  return request<ShareLink>(`/diagrams/${diagramId}/share-link/regenerate`, { method: 'POST' });
}

/** Un usuario con sesión iniciada presenta el token del enlace para obtener acceso. */
export function joinByShareLink(token: string): Promise<JoinResult> {
  return request<JoinResult>(`/share-links/${encodeURIComponent(token)}/join`, { method: 'POST' });
}
