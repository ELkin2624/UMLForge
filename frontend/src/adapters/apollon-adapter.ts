import { UMLModel as ApollonModel, ApollonNode, ApollonEdge, DiagramNodeType, DiagramEdgeType } from '@tumaet/apollon';
import {
  UMLModel as CanonicalModel,
  UMLAttribute,
  UMLOperation,
} from '../types/canonical-model';
import { ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';
import {
  apollonComponentToCanonical,
  canonicalComponentToApollon,
} from './component-apollon-adapter';
import dagre from 'dagre';

export {
  apollonComponentToCanonical,
  canonicalComponentToApollon,
};

export function autoLayoutApollonModel(nodes: ApollonNode[], edges: ApollonEdge[]): void {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 100, edgesep: 50 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(node => {
    // Apollon maneja tamaños fijos iniciales (medidos o asginados)
    const w = node.width || 200;
    const h = node.height || 100;
    g.setNode(node.id, { width: w, height: h });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  nodes.forEach(node => {
    const dagreNode = g.node(node.id);
    if (dagreNode) {
      // dagreNode.x/y es el centro, ajustar a top-left
      node.position = {
        x: Math.round(dagreNode.x - (node.width || 200) / 2),
        y: Math.round(dagreNode.y - (node.height || 100) / 2),
      };
    }
  });
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

  // 1. Identificar las clases y nodos UML del diagrama
  const classLikeTypes = ['class', 'abstractClass', 'interface', 'enumeration', 'package'];
  const classNodes = apollonModel.nodes.filter(n => classLikeTypes.includes(n.type));

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

  // 2. Identificar relaciones (edges) UML 2.5+
  apollonModel.edges.forEach(edge => {
    const sourceNode = apollonModel.nodes.find(n => n.id === edge.source);
    const targetNode = apollonModel.nodes.find(n => n.id === edge.target);

    if (sourceNode && targetNode && classLikeTypes.includes(sourceNode.type) && classLikeTypes.includes(targetNode.type)) {
      let relType = 'Association';
      const edgeTypeLower = edge.type.toLowerCase();

      if (edgeTypeLower.includes('inheritance') || edgeTypeLower.includes('generalization')) {
        relType = 'Generalization';
      } else if (edgeTypeLower.includes('realization')) {
        relType = 'Realization';
      } else if (edgeTypeLower.includes('dependency')) {
        relType = 'Dependency';
      } else if (edgeTypeLower.includes('aggregation')) {
        relType = 'Aggregation';
      } else if (edgeTypeLower.includes('composition')) {
        relType = 'Composition';
      }

      const edgeData = (edge.data || {}) as any;
      const sourceMult = edgeData.sourceMultiplicity || (edge as any).sourceMultiplicity || '1';
      const targetMult = edgeData.targetMultiplicity || (edge as any).targetMultiplicity || '1';

      canonical.relationships.push({
        id: edge.id,
        source_id: edge.source,
        target_id: edge.target,
        type: relType,
        source_multiplicity: sourceMult,
        target_multiplicity: targetMult,
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

  // Relaciones UML 2.5+
  (canonical.relationships || []).forEach(rel => {
    let aType = 'ClassUnidirectional';
    const typeUpper = (rel.type || '').toUpperCase();

    if (typeUpper.includes('GENERALIZATION') || typeUpper.includes('INHERITANCE')) {
      aType = 'ClassInheritance';
    } else if (typeUpper.includes('REALIZATION')) {
      aType = 'ClassRealization';
    } else if (typeUpper.includes('DEPENDENCY')) {
      aType = 'ClassDependency';
    } else if (typeUpper.includes('AGGREGATION')) {
      aType = 'ClassAggregation';
    } else if (typeUpper.includes('COMPOSITION')) {
      aType = 'ClassComposition';
    } else if (typeUpper.includes('BIDIRECTIONAL')) {
      aType = 'ClassBidirectional';
    }

    edges.push({
      id: rel.id,
      source: rel.source_id,
      target: rel.target_id,
      type: aType as DiagramEdgeType,
      sourceHandle: '',
      targetHandle: '',
      data: {
        sourceMultiplicity: rel.source_multiplicity || '1',
        targetMultiplicity: rel.target_multiplicity || '1',
        points: []
      },
    });
  });

  const newModel: ApollonModel = {
    version: '4.0.0',
    id: canonical.id || crypto.randomUUID(),
    title: canonical.name || 'Imported Model',
    type: 'ClassDiagram',
    nodes,
    edges,
    assessments: {},
  };

  autoLayoutApollonModel(newModel.nodes, newModel.edges);
  
  return newModel;
}

/**
 * Aplica un CanonicalModel a una instancia existente de ApollonEditor.
 * Conserva el estado visual local (coordenadas x/y, ancho/alto) de los elementos
 * que ya existen en el editor, evitando que reboten a posiciones por defecto.
 */
export function applyCanonicalModelToApollon(
  editor: NativeApollonEditor,
  canonical: CanonicalModel,
  diagramType: 'class' | 'component',
  visualState?: Record<string, { x: number; y: number }>
): void {
  const currentApollon = editor.model;
  
  // 1. Generar un ApollonModel completamente nuevo basado en el CanonicalModel
  const baseApollon = diagramType === 'component'
    ? canonicalComponentToApollon(canonical)
    : canonicalToApollon(canonical);

  // 2. Crear un mapa de nodos existentes en el editor actual
  const existingNodesMap = new Map<string, ApollonNode>();
  currentApollon.nodes.forEach(node => {
    existingNodesMap.set(node.id, node);
  });

  // 3. Fusionar: conservar estado visual y de UI de nodos existentes, u override remoto
  const mergedNodes = baseApollon.nodes.map(newNode => {
    const existingNode = existingNodesMap.get(newNode.id);
    const remotePos = visualState?.[newNode.id];

    if (existingNode) {
      // Prioridad: 1) Posición remota (visualState), 2) Posición local existente
      const position = remotePos ? { x: remotePos.x, y: remotePos.y } : existingNode.position;

      return {
        ...existingNode,       // Conserva estado de UI (selected, etc.)
        ...newNode,          // Actualiza datos semánticos
        type: existingNode.type, // Conserva tipo visual si ya existía
        position,
      };
    }
    
    // Nodo nuevo
    if (remotePos) {
      return {
        ...newNode,
        position: { x: remotePos.x, y: remotePos.y },
      };
    }

    return newNode;
  });

  // 4. Asignar el modelo resultante a la instancia de Apollon
  const finalApollon: ApollonModel = {
    ...baseApollon,
    nodes: mergedNodes,
  };

  // 5. Aplicar layout automático a todo el diagrama de forma obligatoria
  // Esto asegura que nunca se superpongan las tablas cuando la IA hace cambios
  autoLayoutApollonModel(finalApollon.nodes, finalApollon.edges);

  editor.model = finalApollon;
}


