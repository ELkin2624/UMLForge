import { describe, it, expect } from 'vitest';
import {
  canonicalComponentToApollon,
  apollonComponentToCanonical,
} from '../../src/adapters/apollon-adapter';
import { UMLModel as CanonicalModel } from '../../src/types/canonical-model';
import { UMLModel as ApollonModel } from '@tumaet/apollon';

describe('Component Diagram Apollon Adapter', () => {
  const mockCanonical: CanonicalModel = {
    id: 'arch-model-123',
    name: 'TestArchitecture',
    uml_version: '2.5.1',
    classes: [
      {
        id: 'cls-1',
        name: 'ExistingClass',
        attributes: [],
        operations: [],
      },
    ],
    relationships: [],
    components: [
      {
        id: 'comp-1',
        name: 'FrontendApp',
        description: 'UI layer',
      },
      {
        id: 'comp-2',
        name: 'BackendAPI',
        description: 'Server layer',
      },
    ],
    interfaces: [
      {
        id: 'iface-1',
        name: 'IAuthService',
        operations: [{ id: 'op-1', name: 'login', return_type: 'boolean' }],
      },
    ],
    ports: [
      {
        id: 'port-1',
        name: 'pReq',
        component_id: 'comp-1',
        interface_id: 'iface-1',
        kind: 'required',
      },
      {
        id: 'port-2',
        name: 'pProv',
        component_id: 'comp-2',
        interface_id: 'iface-1',
        kind: 'provided',
      },
    ],
    connectors: [
      {
        id: 'conn-1',
        name: 'AuthConn',
        source_port_id: 'port-1',
        target_port_id: 'port-2',
      },
    ],
    dependencies: [
      {
        id: 'dep-1',
        source_id: 'comp-1',
        target_id: 'iface-1',
        type: 'dependency',
      },
    ],
    diagrams: [],
  };

  it('debería convertir CanonicalModel a Apollon ComponentDiagram preservando UUIDs', () => {
    const apollon = canonicalComponentToApollon(mockCanonical);

    expect(apollon.type).toBe('ComponentDiagram');
    expect(apollon.id).toBe('arch-model-123');

    // Nodos de componentes
    const compNodes = apollon.nodes.filter(n => n.type === 'component');
    expect(compNodes).toHaveLength(2);
    expect(compNodes[0].id).toBe('comp-1');
    expect(compNodes[0].data?.name).toBe('FrontendApp');
    expect(compNodes[1].id).toBe('comp-2');
    expect(compNodes[1].data?.name).toBe('BackendAPI');

    // Nodos de interfaces
    const ifaceNodes = apollon.nodes.filter(n => n.type === 'componentInterface');
    expect(ifaceNodes).toHaveLength(1);
    expect(ifaceNodes[0].id).toBe('iface-1');
    expect(ifaceNodes[0].data?.name).toBe('IAuthService');

    // Dependencias
    const depEdges = apollon.edges.filter(e => e.type === 'ComponentDependency');
    expect(depEdges).toHaveLength(1);
    expect(depEdges[0].id).toBe('dep-1');
    expect(depEdges[0].source).toBe('comp-1');
    expect(depEdges[0].target).toBe('iface-1');
  });

  it('debería convertir Apollon ComponentDiagram a CanonicalModel preservando clases e interfaces previas', () => {
    const apollonModel: ApollonModel = {
      version: '4.0.0',
      id: 'arch-model-123',
      title: 'TestArchitecture',
      type: 'ComponentDiagram',
      nodes: [
        {
          id: 'comp-1',
          type: 'component',
          width: 200,
          height: 120,
          position: { x: 100, y: 100 },
          data: { name: 'FrontendApp' },
          measured: { width: 200, height: 120 },
        },
        {
          id: 'iface-1',
          type: 'componentInterface',
          width: 70,
          height: 70,
          position: { x: 300, y: 300 },
          data: { name: 'IAuthService' },
          measured: { width: 70, height: 70 },
        },
      ],
      edges: [
        {
          id: 'dep-1',
          source: 'comp-1',
          target: 'iface-1',
          type: 'ComponentDependency',
          sourceHandle: '',
          targetHandle: '',
          data: { points: [] },
        },
      ],
      assessments: {},
    };

    const canonical = apollonComponentToCanonical(apollonModel, mockCanonical);

    expect(canonical.id).toBe('arch-model-123');
    // Las clases previas deben conservarse intactas
    expect(canonical.classes).toHaveLength(1);
    expect(canonical.classes[0].name).toBe('ExistingClass');

    // Componentes e interfaces convertidos
    expect(canonical.components).toHaveLength(1);
    expect(canonical.components[0].id).toBe('comp-1');
    expect(canonical.components[0].name).toBe('FrontendApp');

    expect(canonical.interfaces).toHaveLength(1);
    expect(canonical.interfaces[0].id).toBe('iface-1');
    expect(canonical.interfaces[0].name).toBe('IAuthService');
    // Operaciones previas preservadas
    expect(canonical.interfaces[0].operations).toHaveLength(1);
    expect(canonical.interfaces[0].operations[0].name).toBe('login');

    // Dependencia
    expect(canonical.dependencies).toBeDefined();
    expect(canonical.dependencies).toHaveLength(1);
    expect(canonical.dependencies![0].id).toBe('dep-1');
    expect(canonical.dependencies![0].source_id).toBe('comp-1');
    expect(canonical.dependencies![0].target_id).toBe('iface-1');
  });
});
