import { describe, it, expect } from 'vitest';
import { apollonToCanonical, autoDecomposeManyToMany, canonicalToApollon } from './apollon-adapter';
import { apollonComponentToCanonical, canonicalComponentToApollon } from './component-apollon-adapter';
import { UMLModel } from '../types/canonical-model';
import { applyCommands } from '../features/voice';

describe('Auto-decompose Many-to-Many Relationships', () => {
  it('should auto-decompose a Many-to-Many relationship in the adapter into an intermediate class', () => {
    const model: UMLModel = {
      id: 'model-1',
      name: 'Test Model',
      classes: [
        { id: 'c-1', name: 'Usuario', attributes: [], operations: [] },
        { id: 'c-2', name: 'Rol', attributes: [], operations: [] },
      ],
      relationships: [
        {
          id: 'rel-1',
          source_id: 'c-1',
          target_id: 'c-2',
          type: 'Association',
          source_multiplicity: '*',
          target_multiplicity: '*',
        },
      ],
      components: [],
      interfaces: [],
      diagrams: [],
    };

    const visualPositions = {
      'c-1': { x: 100, y: 100 },
      'c-2': { x: 500, y: 100 },
    };

    const result = autoDecomposeManyToMany(model, visualPositions);

    expect(result.decomposed).toBe(true);
    // Should have 3 classes: Usuario, Rol, UsuarioRol
    expect(result.canonical.classes.length).toBe(3);
    const intermediate = result.canonical.classes.find((c) => c.name === 'UsuarioRol');
    expect(intermediate).toBeDefined();
    expect(intermediate?.attributes.some((a) => a.name === 'usuarioId')).toBe(true);
    expect(intermediate?.attributes.some((a) => a.name === 'rolId')).toBe(true);

    // Should have 2 relationships 1 -> *
    expect(result.canonical.relationships.length).toBe(2);
    expect(result.canonical.relationships.every((r) => r.source_multiplicity === '1' && r.target_multiplicity === '*')).toBe(true);

    // Visual position for intermediate should be in the middle
    expect(result.visualState[intermediate!.id]).toEqual({ x: 300, y: 160 });
  });

  it('should auto-decompose Many-to-Many in command-applier for voice/AI commands', () => {
    const model: UMLModel = {
      id: 'model-2',
      name: 'Voice Model',
      classes: [
        { id: 'u1', name: 'Usuario', attributes: [], operations: [] },
        { id: 'r1', name: 'Rol', attributes: [], operations: [] },
      ],
      relationships: [],
      components: [],
      interfaces: [],
      diagrams: [],
    };

    const cmdResult = applyCommands(model, [
      {
        type: 'CREATE_RELATIONSHIP',
        sourceClass: 'Usuario',
        targetClass: 'Rol',
        relationshipType: 'ASSOCIATION',
        sourceMultiplicity: '*',
        targetMultiplicity: '*',
      },
    ]);

    expect(cmdResult.success).toBe(true);
    expect(cmdResult.model?.classes.length).toBe(3);
    expect(cmdResult.model?.classes.some((c: any) => c.name === 'UsuarioRol')).toBe(true);
    expect(cmdResult.model?.relationships.length).toBe(2);
  });
});

describe('Posiciones compartidas del lienzo', () => {
  it('conserva las posiciones al convertir entre modelo canónico y Apollon', () => {
    const model: UMLModel = {
      id: 'shared', name: 'Compartido',
      classes: [{ id: 'a', name: 'Usuario', attributes: [], operations: [] }],
      relationships: [], components: [], interfaces: [], diagrams: [],
      visual_state: { a: { x: 420, y: 180 } },
    };

    const canvas = canonicalToApollon(model);
    expect(canvas.nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 420, y: 180 });
    expect(apollonToCanonical(canvas, model).visual_state?.a).toEqual({ x: 420, y: 180 });
  });

  it('conserva también las posiciones del diagrama de componentes', () => {
    const model: UMLModel = {
      id: 'components', name: 'Componentes', classes: [], relationships: [],
      components: [{ id: 'service', name: 'Servicio' }], interfaces: [], diagrams: [],
      visual_state: { service: { x: 250, y: 360 } },
    };

    const canvas = canonicalComponentToApollon(model);
    expect(canvas.nodes.find((node) => node.id === 'service')?.position).toEqual({ x: 250, y: 360 });
    expect(apollonComponentToCanonical(canvas, model).visual_state?.service).toEqual({ x: 250, y: 360 });
  });

  it('no pierde posiciones al normalizar un cambio sin estado visual temporal', () => {
    const model: UMLModel = {
      id: 'shared', classes: [], relationships: [], components: [], interfaces: [],
      diagrams: [], visual_state: { a: { x: 12, y: 34 } },
    };

    expect(autoDecomposeManyToMany(model).canonical.visual_state?.a).toEqual({ x: 12, y: 34 });
  });
});
