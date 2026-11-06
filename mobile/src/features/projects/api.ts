import { request } from '@/shared/api/client';
import type { DiagramDetail, DiagramSummary, VersionDetail, VersionSummary } from '@/types/api';

export function listDiagrams(): Promise<DiagramSummary[]> {
  return request<DiagramSummary[]>('/diagrams');
}

export function getDiagram(id: number | string): Promise<DiagramDetail> {
  return request<DiagramDetail>(`/diagrams/${id}`);
}

export function listVersions(
  id: number | string,
  opts: { limit?: number; before?: number } = {}
): Promise<VersionSummary[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.before) params.set('before', String(opts.before));
  const qs = params.toString();
  return request<VersionSummary[]>(`/diagrams/${id}/versions${qs ? `?${qs}` : ''}`);
}

export function getVersion(id: number | string, version: number): Promise<VersionDetail> {
  return request<VersionDetail>(`/diagrams/${id}/versions/${version}`);
}
