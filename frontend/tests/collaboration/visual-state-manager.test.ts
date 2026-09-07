import { describe, it, expect } from 'vitest';
import {
  applyVisualStateToModel,
  extractVisualStateFromModel,
  getVisualStateDelta,
  getVisualStateDeletions
} from '../../src/collaboration/visual-state-manager';
import type { UMLModel, DiagramNodeType } from '@tumaet/apollon';

describe('visual-state-manager', () => {
  const dummyModel: UMLModel = {
    version: '4.0.0',
    id: 'test-model',
    title: 'Test Model',
    type: 'ClassDiagram',
    nodes: [
      {
        id: 'node-1',
        type: 'Class' as DiagramNodeType,
        position: { x: 10, y: 20 },
        width: 100,
        height: 80,
        measured: { width: 100, height: 80 },
        data: { name: 'Class1' },
      },
      {
        id: 'node-2',
        type: 'Class' as DiagramNodeType,
        position: { x: 30, y: 40 },
        width: 100,
        height: 80,
        measured: { width: 100, height: 80 },
        data: { name: 'Class2' },
      },
    ],
    edges: [],
    assessments: {},
  };

  describe('extractVisualStateFromModel', () => {
    it('debe extraer coordenadas de los nodos principales', () => {
      const state = extractVisualStateFromModel(dummyModel);
      expect(state).toEqual({
        'node-1': { x: 10, y: 20 },
        'node-2': { x: 30, y: 40 },
      });
    });
  });

  describe('applyVisualStateToModel', () => {
    it('debe actualizar las posiciones de los nodos en el modelo manteniendo los demás intactos', () => {
      const visualState = {
        'node-1': { x: 100, y: 200 },
        'node-new': { x: 500, y: 500 }, // No existe en el modelo, se ignora o no rompe
      };

      const newModel = applyVisualStateToModel(dummyModel, visualState);

      const node1 = newModel.nodes.find(n => n.id === 'node-1');
      const node2 = newModel.nodes.find(n => n.id === 'node-2');

      // Node-1 cambió
      expect(node1?.position.x).toBe(100);
      expect(node1?.position.y).toBe(200);

      // Node-2 intacto
      expect(node2?.position.x).toBe(30);
      expect(node2?.position.y).toBe(40);
      
      // Original intacto (inmutabilidad)
      expect(dummyModel.nodes[0].position.x).toBe(10);
    });
  });

  describe('getVisualStateDelta', () => {
    it('debe calcular los cambios entre dos estados', () => {
      const oldState = {
        'node-1': { x: 10, y: 20 },
        'node-2': { x: 30, y: 40 },
      };
      
      const newState = {
        'node-1': { x: 10, y: 20 },      // Sin cambios
        'node-2': { x: 35, y: 40 },      // Cambió X
        'node-3': { x: 100, y: 100 },    // Nuevo
      };

      const delta = getVisualStateDelta(oldState, newState);
      
      expect(delta).toEqual({
        'node-2': { x: 35, y: 40 },
        'node-3': { x: 100, y: 100 },
      });
      expect(delta['node-1']).toBeUndefined();
    });
  });

  describe('getVisualStateDeletions', () => {
    it('debe detectar nodos borrados', () => {
      const oldState = {
        'node-1': { x: 10, y: 20 },
        'node-2': { x: 30, y: 40 },
      };
      
      const newState = {
        'node-1': { x: 10, y: 20 },      // Existe
        // node-2 desapareció
      };

      const deletions = getVisualStateDeletions(oldState, newState);
      
      expect(deletions).toEqual(['node-2']);
    });
  });
});
