import { UMLModel } from '@tumaet/apollon';

/** Posición y, si el usuario redimensionó el elemento, su tamaño. */
export type Position = { x: number; y: number; width?: number; height?: number };
type VisualState = Record<string, Position>;

const isSize = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

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
        ...(isSize(pos.width) ? { width: pos.width } : {}),
        ...(isSize(pos.height) ? { height: pos.height } : {}),
        ...(isSize(pos.width) && isSize(pos.height)
          ? { measured: { width: pos.width, height: pos.height } }
          : {}),
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
      const entry: Position = { x: node.position.x, y: node.position.y };
      if (isSize(node.width)) entry.width = Math.round(node.width);
      if (isSize(node.height)) entry.height = Math.round(node.height);
      visualState[node.id] = entry;
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
      
      if (
        !oldPos ||
        oldPos.x !== newPos.x ||
        oldPos.y !== newPos.y ||
        oldPos.width !== newPos.width ||
        oldPos.height !== newPos.height
      ) {
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
