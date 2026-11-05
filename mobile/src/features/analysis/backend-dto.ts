import type { UMLModel } from '@/types/canonical-model';

/** Mapea el modelo canónico al DTO de FastAPI (espejo de frontend/src/api/models-api.ts). */
export function toBackendModel(model: UMLModel): Record<string, unknown> {
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
      const srcId = rel.source_id || (rel as unknown as Record<string, string | undefined>).source || '';
      const tgtId = rel.target_id || (rel as unknown as Record<string, string | undefined>).target || '';
      const srcClass = (model.classes || []).find(c => c.id === srcId);
      const tgtClass = (model.classes || []).find(c => c.id === tgtId);
      const defaultName = (srcClass && tgtClass)
        ? `${srcClass.name}_${tgtClass.name}`
        : (srcId ? `rel_${srcId.substring(0, 4)}` : 'rel');

      const explicitName = (rel as unknown as Record<string, string | undefined>).name;
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
      source: dep.source_id || (dep as unknown as Record<string, string | undefined>).source,
      target: dep.target_id || (dep as unknown as Record<string, string | undefined>).target,
      type: (dep.type || 'dependency').toLowerCase(),
    })),
    diagrams: [],
  };
}

