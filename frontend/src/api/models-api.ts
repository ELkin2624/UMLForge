import { request } from './client';
import { UMLModel } from '../types/canonical-model';
import { ValidationResult, DeploymentResult, E2EResult } from '../types/api-responses';

const API_BASE_URL = '/api/v1';

/** Mapea el CanonicalModel del frontend al DTO esperado por FastAPI,
 * sanitizando el ID del modelo, normalizando relaciones y campos para evitar fallos de validación.
 */
function mapToBackendDTO(model: UMLModel): any {
  const sanitizeId = (id?: string) => {
    if (!id || id.trim() === '') return 'uml_model';
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
  };

  return {
    ...model,
    id: sanitizeId(model.id),
    name: model.name || 'UML Model',
    classes: (model.classes || []).map(cls => ({
      id: cls.id,
      name: cls.name,
      attributes: (cls.attributes || []).map(attr => ({
        id: attr.id,
        name: attr.name,
        type: attr.type || 'String',
        visibility: attr.visibility || 'private',
      })),
      operations: (cls.operations || []).map(op => ({
        id: op.id,
        name: op.name,
        return_type: op.return_type || 'void',
        visibility: op.visibility || 'public',
      })),
    })),
    relationships: (model.relationships || []).map(rel => {
      const srcId = rel.source_id || (rel as any).source || '';
      const tgtId = rel.target_id || (rel as any).target || '';
      const srcClass = (model.classes || []).find(c => c.id === srcId);
      const tgtClass = (model.classes || []).find(c => c.id === tgtId);
      const defaultName = (srcClass && tgtClass)
        ? `${srcClass.name}_${tgtClass.name}`
        : (srcId ? `rel_${srcId.substring(0, 4)}` : 'rel');

      const explicitName = (rel as any).name;
      const finalName = explicitName && !explicitName.startsWith('rel_') && explicitName !== 'rel'
        ? explicitName
        : defaultName;

      return {
        id: rel.id,
        name: finalName,
        source: srcId,
        target: tgtId,
        type: (rel.type || 'association').toLowerCase(),
        source_multiplicity: rel.source_multiplicity || '1',
        target_multiplicity: rel.target_multiplicity || '1',
      };
    }),
    dependencies: (model.dependencies || []).map(dep => ({
      id: dep.id,
      source: dep.source_id || (dep as any).source,
      target: dep.target_id || (dep as any).target,
      type: (dep.type || 'dependency').toLowerCase(),
    })),
    diagrams: [],
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

