import { request } from './client';
import { UMLModel } from '../types/canonical-model';
import { ValidationResult, DeploymentResult, E2EResult } from '../types/api-responses';

const API_BASE_URL = '/api/v1';

/** Mapea el CanonicalModel del frontend al DTO esperado por FastAPI,
 * reemplazando source_id -> source, target_id -> target, y normalizando rel.type a minúsculas.
 */
function mapToBackendDTO(model: UMLModel): any {
  return {
    ...model,
    relationships: model.relationships.map(rel => ({
      id: rel.id,
      name: (rel as any).name || `rel_${rel.source_id.substring(0,4)}`,
      source: rel.source_id,
      target: rel.target_id,
      type: rel.type.toLowerCase(),
      source_multiplicity: rel.source_multiplicity,
      target_multiplicity: rel.target_multiplicity,
    })),
    dependencies: model.dependencies?.map(dep => ({
      id: dep.id,
      source: dep.source_id,
      target: dep.target_id,
      type: dep.type?.toLowerCase() || 'dependency',
    })),
  };
}

export async function validateModel(model: UMLModel): Promise<ValidationResult> {
  const dto = mapToBackendDTO(model);
  return request<ValidationResult>('/models/validate', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function deployProject(model: UMLModel): Promise<DeploymentResult> {
  const dto = mapToBackendDTO(model);
  return request<DeploymentResult>('/projects/deploy', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function validateE2E(model: UMLModel): Promise<E2EResult> {
  const dto = mapToBackendDTO(model);
  return request<E2EResult>('/projects/validate-e2e', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function generateProject(model: UMLModel, localPath?: string): Promise<Blob | any> {
  const url = `${API_BASE_URL}/models/generate`;
  const dto = mapToBackendDTO(model);
  const requestBody: any = {
    project_name: model.name || 'project',
    package_name: 'com.example.project',
    model_data: dto,
  };
  
  if (localPath) {
    requestBody.local_output_path = localPath;
  }
  
  const headers: any = {
    'Content-Type': 'application/json',
  };
  
  if (!localPath) {
    headers['Accept'] = 'application/zip';
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errorDetail = 'Error generando proyecto';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail?.message || errorData.detail || JSON.stringify(errorData);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail || `HTTP error! status: ${response.status}`);
  }

  if (localPath) {
    return response.json();
  }
  
  return response.blob();
}

export async function importXMI(file: File): Promise<{ model: UMLModel, warnings: any[] }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/models/import/xmi`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = 'Error importando XMI';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail?.message || errorData.detail || JSON.stringify(errorData);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  // Mapeamos devuelta source -> source_id
  const frontendModel = {
    ...result.model,
    relationships: result.model.relationships?.map((rel: any) => ({
      id: rel.id,
      source_id: rel.source,
      target_id: rel.target,
      type: rel.type,
      source_multiplicity: rel.source_multiplicity,
      target_multiplicity: rel.target_multiplicity,
    })) || [],
    dependencies: result.model.dependencies?.map((dep: any) => ({
      id: dep.id,
      source_id: dep.source,
      target_id: dep.target,
      type: dep.type,
    })) || [],
  };

  return { model: frontendModel, warnings: result.warnings };
}

export async function exportXMI(model: UMLModel): Promise<Blob> {
  const url = `${API_BASE_URL}/models/export/xmi`;
  const dto = mapToBackendDTO(model);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/xml',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    let errorDetail = 'Error exportando XMI';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail?.message || errorData.detail || JSON.stringify(errorData);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail || `HTTP error! status: ${response.status}`);
  }

  return response.blob();
}

