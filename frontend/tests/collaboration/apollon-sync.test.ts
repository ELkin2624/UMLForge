import { describe, it, expect, beforeEach } from 'vitest';
import { ApollonEditor as NativeApollonEditor, UMLModel as ApollonModel, DiagramNodeType } from '@tumaet/apollon';
import { applyCanonicalModelToApollon } from '../../src/adapters/apollon-adapter';
import { UMLModel as CanonicalModel } from '../../src/types/canonical-model';

describe('Apollon Visual Sync (applyCanonicalModelToApollon)', () => {
  let mockEditor: any;

  beforeEach(() => {
    mockEditor = {
      model: {
        version: '4.0.0',
        id: 'test-model',
        title: 'Test',
        type: 'ClassDiagram',
        nodes: [
          {
            id: 'node-1',
            type: 'class' as DiagramNodeType,
            position: { x: 500, y: 600 }, // Posición personalizada
            width: 200,
            height: 100,
            measured: { width: 200, height: 100 },
            data: { name: 'ExistingClass', attributes: [], methods: [] },
          }
        ],
        edges: [],
        assessments: {}
      } as unknown as ApollonModel
    };
  });

  it('debe mantener las posiciones x, y de los nodos existentes y actualizar sus datos', () => {
    const remoteModel: CanonicalModel = {
      id: 'test-model',
      name: 'Test',
      uml_version: '2.5.1',
      classes: [
        {
          id: 'node-1',
          name: 'RenamedClass',
          attributes: [{ id: 'attr-1', name: 'newAttr', type: 'String', visibility: 'private' }],
          operations: [],
        }
      ],
      relationships: [],
      components: [],
      interfaces: [],
      ports: [],
      connectors: [],
      dependencies: [],
      diagrams: [],
    };

    applyCanonicalModelToApollon(mockEditor as unknown as NativeApollonEditor, remoteModel, 'class');

    const updatedNodes = mockEditor.model.nodes;
    expect(updatedNodes).toHaveLength(1);
    
    // UUID y posición se conservan
    expect(updatedNodes[0].id).toBe('node-1');
    expect(updatedNodes[0].position).toEqual({ x: 500, y: 600 });
    
    // Los datos semánticos se actualizan
    expect(updatedNodes[0].data.name).toBe('RenamedClass');
    expect(updatedNodes[0].data.attributes).toHaveLength(1);
  });

  it('debe añadir nodos nuevos en las posiciones por defecto sin afectar a los existentes', () => {
    const remoteModel: CanonicalModel = {
      id: 'test-model',
      name: 'Test',
      uml_version: '2.5.1',
      classes: [
        {
          id: 'node-1',
          name: 'ExistingClass',
          attributes: [],
          operations: [],
        },
        {
          id: 'node-2',
          name: 'NewClass',
          attributes: [],
          operations: [],
        }
      ],
      relationships: [],
      components: [],
      interfaces: [],
      ports: [],
      connectors: [],
      dependencies: [],
      diagrams: [],
    };

    applyCanonicalModelToApollon(mockEditor as unknown as NativeApollonEditor, remoteModel, 'class');

    const updatedNodes = mockEditor.model.nodes;
    expect(updatedNodes).toHaveLength(2);
    
    // El nodo 1 conserva su posición manual
    const node1 = updatedNodes.find((n: any) => n.id === 'node-1');
    expect(node1.position).toEqual({ x: 500, y: 600 });

    // El nodo 2 tiene una posición generada (x=350, y=100 según el adapter)
    const node2 = updatedNodes.find((n: any) => n.id === 'node-2');
    expect(node2.position).toBeDefined();
    expect(node2.position.x).not.toBe(500); // Diferente a node-1
  });

  it('debe eliminar nodos que ya no están en el modelo canónico', () => {
    const remoteModel: CanonicalModel = {
      id: 'test-model',
      name: 'Test',
      uml_version: '2.5.1',
      classes: [], // El nodo 1 fue eliminado remotamente
      relationships: [],
      components: [],
      interfaces: [],
      ports: [],
      connectors: [],
      dependencies: [],
      diagrams: [],
    };

    applyCanonicalModelToApollon(mockEditor as unknown as NativeApollonEditor, remoteModel, 'class');

    const updatedNodes = mockEditor.model.nodes;
    expect(updatedNodes).toHaveLength(0);
  });

  it('debe actualizar los diagramas de componentes de manera aislada', () => {
    // Simulamos que el editor actual es un diagrama de componentes
    mockEditor.model = {
      version: '4.0.0',
      id: 'test-model',
      title: 'Test',
      type: 'ComponentDiagram',
        nodes: [
          {
            id: 'comp-1',
            type: 'component' as DiagramNodeType,
            position: { x: 300, y: 300 },
            width: 200,
            height: 120,
            measured: { width: 200, height: 120 },
            data: { name: 'User Service' },
          }
        ],
        edges: [],
        assessments: {}
      } as unknown as ApollonModel;

    const remoteModel: CanonicalModel = {
      id: 'test-model',
      name: 'Test',
      uml_version: '2.5.1',
      classes: [], // Sin clases
      relationships: [],
      components: [
        { id: 'comp-1', name: 'User Service v2' }
      ],
      interfaces: [],
      ports: [],
      connectors: [],
      dependencies: [],
      diagrams: [],
    };

    applyCanonicalModelToApollon(mockEditor as unknown as NativeApollonEditor, remoteModel, 'component');

    const updatedNodes = mockEditor.model.nodes;
    expect(updatedNodes).toHaveLength(1);
    expect(updatedNodes[0].id).toBe('comp-1');
    expect(updatedNodes[0].data.name).toBe('User Service v2');
    expect(updatedNodes[0].position).toEqual({ x: 300, y: 300 }); // Conserva posición del componente
  });

  it('debe ser idempotente si se aplica el mismo modelo dos veces', () => {
    const remoteModel: CanonicalModel = {
      id: 'test-model',
      name: 'Test',
      uml_version: '2.5.1',
      classes: [
        {
          id: 'node-1',
          name: 'ExistingClass',
          attributes: [],
          operations: [],
        }
      ],
      relationships: [],
      components: [],
      interfaces: [],
      ports: [],
      connectors: [],
      dependencies: [],
      diagrams: [],
    };

    // Aplicar una vez
    applyCanonicalModelToApollon(mockEditor as unknown as NativeApollonEditor, remoteModel, 'class');

    // Modificamos manualmente la posición como si el usuario lo hubiera movido
    mockEditor.model.nodes[0].position = { x: 999, y: 999 };

    // Aplicar segunda vez (mismo modelo semántico)
    applyCanonicalModelToApollon(mockEditor as unknown as NativeApollonEditor, remoteModel, 'class');
    
    // No debe sobrescribir la posición modificada localmente porque los UUIDs coinciden
    const nodesAfterSecond = mockEditor.model.nodes;
    expect(nodesAfterSecond).toHaveLength(1);
    expect(nodesAfterSecond[0].position).toEqual({ x: 999, y: 999 });
  });
});
