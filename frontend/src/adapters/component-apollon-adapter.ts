import { UMLModel as ApollonModel, ApollonNode, ApollonEdge, DiagramNodeType, DiagramEdgeType } from '@tumaet/apollon';
import {
  UMLModel as CanonicalModel,
  UMLComponent,
  UMLInterface,
  UMLPort,
  UMLConnector,
  UMLDependency,
} from '../types/canonical-model';

/**
 * Adapter from Apollon Component Diagram to Canonical Model.
 * Preserva UUIDs existentes y datos de clases previos.
 */
export function apollonComponentToCanonical(
  apollonModel: ApollonModel,
  existingCanonical?: CanonicalModel
): CanonicalModel {
  const stableId = apollonModel.id && apollonModel.id.length > 0
    ? apollonModel.id
    : existingCanonical?.id || 'default-model';

  const components: UMLComponent[] = [];
  const interfaces: UMLInterface[] = [];
  const dependencies: UMLDependency[] = [];

  // Map existing interfaces for operation preservation
  const existingIfaceMap = new Map<string, UMLInterface>();
  (existingCanonical?.interfaces || []).forEach(i => existingIfaceMap.set(i.id, i));

  // 1. Identificar Componentes e Interfaces
  apollonModel.nodes.forEach(node => {
    const nodeData = node.data as { name?: string };
    const nameStr = nodeData?.name || 'Unnamed';

    if (node.type === 'component') {
      components.push({
        id: node.id,
        name: nameStr,
      });
    } else if (node.type === 'componentInterface') {
      const existing = existingIfaceMap.get(node.id);
      interfaces.push({
        id: node.id,
        name: nameStr,
        operations: existing?.operations || [],
      });
    }
  });

  // 2. Identificar Dependencias
  apollonModel.edges.forEach(edge => {
    if (edge.type === 'ComponentDependency') {
      dependencies.push({
        id: edge.id,
        source_id: edge.source,
        target_id: edge.target,
        type: 'dependency',
      });
    }
  });

  // Preservar puertos y conectores existentes si sus elementos siguen existiendo
  const compIds = new Set(components.map(c => c.id));
  const ifaceIds = new Set(interfaces.map(i => i.id));

  const preservedPorts: UMLPort[] = (existingCanonical?.ports || []).filter(
    p => compIds.has(p.component_id) && ifaceIds.has(p.interface_id)
  );
  const portIds = new Set(preservedPorts.map(p => p.id));
  const preservedConnectors: UMLConnector[] = (existingCanonical?.connectors || []).filter(
    c => portIds.has(c.source_port_id) && portIds.has(c.target_port_id)
  );

  return {
    id: stableId,
    name: apollonModel.title || existingCanonical?.name || 'UML Model',
    uml_version: existingCanonical?.uml_version || '2.5.1',
    // Preservar clases y relaciones previas intactas
    classes: existingCanonical?.classes || [],
    relationships: existingCanonical?.relationships || [],
    // Componentes actualizados
    components,
    interfaces,
    ports: preservedPorts,
    connectors: preservedConnectors,
    dependencies,
    diagrams: existingCanonical?.diagrams || [],
  };
}

/**
 * Adapter from Canonical Model to Apollon Component Diagram.
 */
export function canonicalComponentToApollon(canonical: CanonicalModel): ApollonModel {
  const nodes: ApollonNode[] = [];
  const edges: ApollonEdge[] = [];

  let compX = 100;
  let compY = 100;

  // 1. Componentes
  (canonical.components || []).forEach(comp => {
    const compNode: ApollonNode = {
      id: comp.id,
      type: 'component' as DiagramNodeType,
      width: 200,
      height: 120,
      position: { x: compX, y: compY },
      data: {
        name: comp.name,
      },
      measured: { width: 200, height: 120 },
    };
    nodes.push(compNode);

    compX += 280;
    if (compX > 800) {
      compX = 100;
      compY += 220;
    }
  });

  // 2. Interfaces
  let ifaceX = 150;
  let ifaceY = compY + 160;

  (canonical.interfaces || []).forEach(iface => {
    const ifaceNode: ApollonNode = {
      id: iface.id,
      type: 'componentInterface' as DiagramNodeType,
      width: 70,
      height: 70,
      position: { x: ifaceX, y: ifaceY },
      data: {
        name: iface.name,
      },
      measured: { width: 70, height: 70 },
    };
    nodes.push(ifaceNode);

    ifaceX += 220;
    if (ifaceX > 800) {
      ifaceX = 150;
      ifaceY += 140;
    }
  });

  // 3. Dependencias
  (canonical.dependencies || []).forEach(dep => {
    edges.push({
      id: dep.id,
      source: dep.source_id,
      target: dep.target_id,
      type: 'ComponentDependency' as DiagramEdgeType,
      sourceHandle: '',
      targetHandle: '',
      data: { points: [] },
    });
  });

  return {
    version: '4.0.0',
    id: canonical.id || crypto.randomUUID(),
    title: canonical.name || 'Component Diagram',
    type: 'ComponentDiagram',
    nodes,
    edges,
    assessments: {},
  };
}
