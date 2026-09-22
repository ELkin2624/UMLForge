import { UMLModel } from '@tumaet/apollon';

type Position = { x: number; y: number };
type VisualState = Record<string, Position>;

/**
 * Fusiona un modelo base con un estado visual remoto.
 * Retorna un nuevo UMLModel con las posiciones de los nodos actualizadas.
 */
export function applyVisualStateToModel(
  baseModel: UMLModel,
  visualState: VisualState
): UMLModel {
  const newModel = JSON.parse(JSON.stringify(baseModel)) as UMLModel;

  if (!newModel.nodes || !Array.isArray(newModel.nodes)) return newModel;

  newModel.nodes = newModel.nodes.map(node => {
    const pos = visualState[node.id];
    if (pos) {
      return {
        ...node,
        position: { x: pos.x, y: pos.y },
      };
    }
    return node;
  });

  return newModel;
}

/**
 * Extrae las posiciones de los nodos principales desde un UMLModel.
 */
export function extractVisualStateFromModel(model: UMLModel): VisualState {
  const visualState: VisualState = {};
  if (!model.nodes || !Array.isArray(model.nodes)) return visualState;

  for (const node of model.nodes) {
    if (node.position) {
      visualState[node.id] = {
        x: node.position.x,
        y: node.position.y,
      };
    }
  }
  return visualState;
}

/**
 * Compara dos estados visuales y retorna los elementos que han cambiado de posición.
 */
export function getVisualStateDelta(
  oldState: VisualState,
  newState: VisualState
): VisualState {
  const delta: VisualState = {};
  for (const elementId in newState) {
    if (Object.prototype.hasOwnProperty.call(newState, elementId)) {
      const oldPos = oldState[elementId];
      const newPos = newState[elementId];
      
      if (!oldPos || oldPos.x !== newPos.x || oldPos.y !== newPos.y) {
        delta[elementId] = newPos;
      }
    }
  }
  return delta;
}

/**
 * Retorna un arreglo con los IDs de los elementos que existían en el estado viejo 
 * pero ya no existen en el nuevo (fueron borrados).
 */
export function getVisualStateDeletions(
  oldState: VisualState,
  newState: VisualState
): string[] {
  const deletions: string[] = [];
  for (const elementId in oldState) {
    if (Object.prototype.hasOwnProperty.call(oldState, elementId)) {
      if (!Object.prototype.hasOwnProperty.call(newState, elementId)) {
        deletions.push(elementId);
      }
    }
  }
  return deletions;
}
