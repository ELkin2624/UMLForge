import { UMLModel } from '../../../types/canonical-model';
import { ModelStats } from './types';

/**
 * Descarga un Blob en el navegador creando un enlace temporal <a>.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Calcula estadísticas cuantitativas de un modelo UML para previsualización.
 */
export function calculateModelStats(model?: UMLModel | null): ModelStats {
  if (!model) {
    return { classCount: 0, attrCount: 0, opCount: 0, relCount: 0 };
  }
  const classCount = model.classes?.length || 0;
  const attrCount = model.classes?.reduce((sum, c) => sum + (c.attributes?.length || 0), 0) || 0;
  const opCount = model.classes?.reduce((sum, c) => sum + (c.operations?.length || 0), 0) || 0;
  const relCount = model.relationships?.length || 0;
  return { classCount, attrCount, opCount, relCount };
}

/**
 * Genera el texto de confirmación previa a la generación de código.
 */
export function buildGenerationPreviewMessage(stats: ModelStats): string {
  return `Resumen a generar:\nClases: ${stats.classCount}\nAtributos: ${stats.attrCount}\nOperaciones: ${stats.opCount}\nRelaciones: ${stats.relCount}\n\n¿Deseas continuar?`;
}

/**
 * Solicita al usuario la ruta local de salida y la recuerda en localStorage.
 */
export function promptLocalOutputPath(
  defaultFallback = 'C:\\Parcial-sw1-of\\backend-springboot'
): string | null {
  const defaultPath = localStorage.getItem('lastLocalOutputPath') || defaultFallback;
  const inputPath = window.prompt('Ruta de salida para el backend Spring Boot:', defaultPath);
  if (!inputPath) return null;
  localStorage.setItem('lastLocalOutputPath', inputPath);
  return inputPath;
}
