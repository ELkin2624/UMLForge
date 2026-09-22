import { ToolRegistry } from './ToolRegistry';
import { ToolCall, ToolDefinition } from './types';

export interface ValidationResult {
  valid: boolean;
  tool?: ToolDefinition;
  sanitizedArgs?: Record<string, any>;
  error?: string;
}

export class ToolValidator {
  constructor(private registry: ToolRegistry) {}

  validate(call: ToolCall): ValidationResult {
    const tool = this.registry.getTool(call.name);
    if (!tool) {
      return {
        valid: false,
        error: `La herramienta '${call.name}' no está registrada en el sistema.`,
      };
    }

    const schema = tool.parameters;
    const args = typeof call.arguments === 'object' && call.arguments !== null ? call.arguments : {};

    // 1. Validar parámetros requeridos
    if (schema.required && Array.isArray(schema.required)) {
      for (const reqField of schema.required) {
        if (args[reqField] === undefined || args[reqField] === null || args[reqField] === '') {
          return {
            valid: false,
            error: `Falta el parámetro requerido '${reqField}' para la herramienta '${call.name}'.`,
          };
        }
      }
    }

    // 2. Validar tipos de datos y sanitizar
    const sanitizedArgs: Record<string, any> = {};
    const properties = schema.properties || {};

    for (const [key, value] of Object.entries(args)) {
      const propSchema = properties[key];
      if (!propSchema) {
        // Campo no reconocido por el esquema
        continue;
      }

      const expectedType = propSchema.type;
      const actualType = typeof value;

      if (expectedType === 'integer' || expectedType === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          return {
            valid: false,
            error: `El parámetro '${key}' debe ser numérico. Se recibió: ${JSON.stringify(value)}.`,
          };
        }
        sanitizedArgs[key] = num;
      } else if (expectedType === 'boolean') {
        sanitizedArgs[key] = Boolean(value);
      } else if (expectedType === 'string') {
        sanitizedArgs[key] = String(value);
      } else {
        sanitizedArgs[key] = value;
      }
    }

    // 3. Validar consistencia de ruta y método
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(tool.method.toUpperCase())) {
      return {
        valid: false,
        error: `Método HTTP inválido en la definición de la herramienta: ${tool.method}`,
      };
    }

    return {
      valid: true,
      tool,
      sanitizedArgs,
    };
  }
}
