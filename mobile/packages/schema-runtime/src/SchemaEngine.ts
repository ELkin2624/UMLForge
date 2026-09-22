import { MobileEntityConfig, MobileFieldConfig, MobileSchemaInfo } from './types';

export class SchemaEngine {
  constructor(private schema: MobileSchemaInfo) {}

  getEntity(name: string): MobileEntityConfig | undefined {
    return this.schema.entities.find(
      (e) => e.name.toLowerCase() === name.toLowerCase() || e.table_name.toLowerCase() === name.toLowerCase()
    );
  }

  getAllEntities(): MobileEntityConfig[] {
    return this.schema.entities;
  }

  getVisibleListFields(entity: MobileEntityConfig): MobileFieldConfig[] {
    return entity.fields.filter((f) => f.is_list_visible && !f.is_primary_key);
  }

  formatFieldValue(field: MobileFieldConfig, value: any): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (field.ui_type === 'currency') {
      const num = Number(value);
      return isNaN(num) ? String(value) : `$${num.toFixed(2)}`;
    }

    if (field.ui_type === 'date' || field.ui_type === 'datetime') {
      try {
        const d = new Date(value);
        return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
      } catch {
        return String(value);
      }
    }

    if (field.ui_type === 'boolean') {
      return value ? 'Sí' : 'No';
    }

    return String(value);
  }

  validateForm(
    entity: MobileEntityConfig,
    data: Record<string, any>
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const field of entity.fields) {
      if (field.is_primary_key) continue;

      const val = data[field.name];

      if (field.required && (val === undefined || val === null || val === '')) {
        errors[field.name] = `El campo ${field.label} es obligatorio.`;
        continue;
      }

      if (val !== undefined && val !== null && val !== '') {
        if (field.ui_type === 'number' || field.ui_type === 'currency') {
          if (isNaN(Number(val))) {
            errors[field.name] = `${field.label} debe ser un número válido.`;
          }
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
