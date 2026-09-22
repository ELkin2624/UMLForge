import { UMLModel } from '../../../types/canonical-model';
import { UMLCommand } from '../model/types';

export interface ParseIntentResponse {
  commands?: UMLCommand[];
  message?: string;
  detail?: string;
}

/**
 * Llama al backend FastAPI para interpretar texto de voz en comandos estructurados UML mediante LLM.
 */
export async function parseIntentRemote(
  text: string,
  currentModel: UMLModel,
  initialContext?: string
): Promise<UMLCommand[]> {
  const response = await fetch('/api/v1/voice/parse-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      current_model: currentModel,
      initial_context: initialContext,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ParseIntentResponse = await response.json();
  return data.commands || [];
}
