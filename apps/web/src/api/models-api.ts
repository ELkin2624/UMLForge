import { request } from './client';
import { UMLModel } from '../types/canonical-model';
import { ValidationResult, DeploymentResult, E2EResult } from '../types/api-responses';

const API_BASE_URL = '/api/v1';

export async function validateModel(model: UMLModel): Promise<ValidationResult> {
  return request<ValidationResult>('/models/validate', {
    method: 'POST',
    body: JSON.stringify(model),
  });
}

export async function deployProject(model: UMLModel): Promise<DeploymentResult> {
  return request<DeploymentResult>('/projects/deploy', {
    method: 'POST',
    body: JSON.stringify(model),
  });
}

export async function validateE2E(model: UMLModel): Promise<E2EResult> {
  return request<E2EResult>('/projects/validate-e2e', {
    method: 'POST',
    body: JSON.stringify(model),
  });
}

export async function generateProject(model: UMLModel): Promise<Blob> {
  const url = `${API_BASE_URL}/models/generate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/zip',
    },
    body: JSON.stringify(model),
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

  return response.blob();
}
