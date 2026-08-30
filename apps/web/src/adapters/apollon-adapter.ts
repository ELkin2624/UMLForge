import { UMLModel as ApollonModel, ApollonNode, ApollonEdge, DiagramNodeType, DiagramEdgeType } from '@tumaet/apollon';
import {
  UMLModel as CanonicalModel,
  UMLAttribute,
  UMLOperation,
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

/**
 * Adapter from Apollon to Canonical Model.
 * Despacha según apollonModel.type y preserva el submodelo no activo.
 */
export function apollonToCanonical(
  apollonModel: ApollonModel,
  existingCanonical?: CanonicalModel
): CanonicalModel {
  if (apollonModel.type === 'ComponentDiagram') {
    return apollonComponentToCanonical(apollonModel, existingCanonical);
  }

  const stableId = apollonModel.id && apollonModel.id.length > 0
    ? apollonModel.id
    : existingCanonical?.id || 'default-model';

  const canonical: CanonicalModel = {
    id: stableId,
    name: apollonModel.title || existingCanonical?.name || 'UML Model',
    uml_version: existingCanonical?.uml_version || '2.5.1',
    classes: [],
    relationships: [],
    // Preservar componentes y conectores existentes
    components: existingCanonical?.components || [],
    interfaces: existingCanonical?.interfaces || [],
    ports: existingCanonical?.ports || [],
    connectors: existingCanonical?.connectors || [],
    dependencies: existingCanonical?.dependencies || [],
    diagrams: existingCanonical?.diagrams || [],
  };

  // 1. Identificar las clases (nodos de tipo 'class')
  const classNodes = apollonModel.nodes.filter(n => n.type === 'class');

  classNodes.forEach(classNode => {
    const classData = classNode.data as {
      name?: string;
      attributes?: Array<{ id: string; name?: string }>;
      methods?: Array<{ id: string; name?: string }>;
    } || {};

    const nameStr = classData.name || 'Unnamed';
    const apollonAttributes = classData.attributes || [];
    const apollonMethods = classData.methods || [];

    const attributes: UMLAttribute[] = apollonAttributes.map(attr => {
      const attrName = attr.name || 'Unnamed';
      return {
        id: attr.id,
        name: attrName.split(':')[0]?.trim() || attrName,
        type: attrName.split(':')[1]?.trim() || 'String',
        visibility: 'private',
      };
    });

    const operations: UMLOperation[] = apollonMethods.map(op => {
      const opName = op.name || 'Unnamed';
      return {
        id: op.id,
        name: opName.split('(')[0]?.trim() || opName,
        return_type: opName.split(':')[1]?.trim() || 'void',
        visibility: 'public',
      };
    });

    canonical.classes.push({
      id: classNode.id,
      name: nameStr,
      attributes,
      operations,
    });
  });

  // 2. Identificar relaciones (edges)
  apollonModel.edges.forEach(edge => {
    const sourceNode = apollonModel.nodes.find(n => n.id === edge.source);
    const targetNode = apollonModel.nodes.find(n => n.id === edge.target);

    if (sourceNode?.type === 'class' && targetNode?.type === 'class') {
      let relType = 'Association';
      if (edge.type.toLowerCase().includes('inheritance') || edge.type.toLowerCase().includes('generalization')) {
        relType = 'Generalization';
      }

      canonical.relationships.push({
        id: edge.id,
        source_id: edge.source,
        target_id: edge.target,
        type: relType,
        source_multiplicity: '1',
        target_multiplicity: '1',
      });
    }
  });

  return canonical;
}

/**
 * Adapter from Canonical Model to Apollon (Class Diagram).
 */
export function canonicalToApollon(canonical: CanonicalModel): ApollonModel {
  const nodes: ApollonNode[] = [];
  const edges: ApollonEdge[] = [];
  
  let x = 100;
  let y = 100;

  // Clases
  (canonical.classes || []).forEach(cls => {
    const classNode: ApollonNode = {
      id: cls.id,
      type: 'class' as DiagramNodeType,
      width: 200,
      height: 100 + (cls.attributes.length + cls.operations.length) * 30,
      position: { x, y },
      data: { 
        name: cls.name,
        attributes: cls.attributes.map(attr => ({
          id: attr.id,
          name: `${attr.name}: ${attr.type}`,
          type: 'classAttribute',
        })),
        methods: cls.operations.map(op => ({
          id: op.id,
          name: `${op.name}(): ${op.return_type || 'void'}`,
          type: 'classMethod',
        })),
      },
      measured: { width: 200, height: 100 },
    };
    nodes.push(classNode);

    x += 250;
    if (x > 800) {
      x = 100;
      y += 200;
    }
  });

  // Relaciones
  (canonical.relationships || []).forEach(rel => {
    let aType = 'ClassUnidirectional';
    if (rel.type === 'Generalization') {
      aType = 'ClassInheritance';
    }

    edges.push({
      id: rel.id,
      source: rel.source_id,
      target: rel.target_id,
      type: aType as DiagramEdgeType,
      sourceHandle: '',
      targetHandle: '',
      data: { points: [] },
    });
  });

  return {
    version: '4.0.0',
    id: canonical.id || crypto.randomUUID(),
    title: canonical.name || 'Imported Model',
    type: 'ClassDiagram',
    nodes,
    edges,
    assessments: {},
  };
}


