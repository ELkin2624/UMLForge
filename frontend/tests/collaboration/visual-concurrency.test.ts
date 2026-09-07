import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  createYjsDocument,
  updateVisualStateNode,
  getVisualStateRecord,
} from '../../src/collaboration/yjs-document';
import { applyVisualStateToModel } from '../../src/collaboration/visual-state-manager';
import type { UMLModel, DiagramNodeType } from '@tumaet/apollon';

describe('Visual State Concurrency & Sync', () => {
  it('Usuario A mueve Nodo 1 y Usuario B mueve Nodo 2 concurrentemente sin sobrescribirse', () => {
    const docA = createYjsDocument();
    const docB = createYjsDocument();

    // Sincronizar docA y docB inicialmente
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    // Usuario A mueve Cliente (node-1) a (150, 200)
    updateVisualStateNode(docA, 'node-1', { x: 150, y: 200 }, 'umlforge-local');

    // Usuario B mueve Cita (node-2) a (600, 400)
    updateVisualStateNode(docB, 'node-2', { x: 600, y: 400 }, 'umlforge-local');

    // Sincronizar los cambios concurrentes entre peers
    const updateFromA = Y.encodeStateAsUpdate(docA);
    const updateFromB = Y.encodeStateAsUpdate(docB);

    Y.applyUpdate(docB, updateFromA);
    Y.applyUpdate(docA, updateFromB);

    // Ambos documentos deben tener exactamente las dos posiciones
    const stateA = getVisualStateRecord(docA);
    const stateB = getVisualStateRecord(docB);

    expect(stateA).toEqual({
      'node-1': { x: 150, y: 200 },
      'node-2': { x: 600, y: 400 },
    });
    expect(stateB).toEqual(stateA);
  });

  it('Nuevo peer que entra recibe el modelo canónico y las posiciones exactas de visual-state', () => {
    const serverDoc = createYjsDocument();

    // Se establece el visual-state en el servidor
    updateVisualStateNode(serverDoc, 'node-1', { x: 300, y: 450 }, 'umlforge-local');
    updateVisualStateNode(serverDoc, 'node-2', { x: 100, y: 150 }, 'umlforge-local');

    // Nuevo cliente B entra y descarga el documento completo
    const clientDoc = createYjsDocument();
    Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));

    const visualSnapshot = getVisualStateRecord(clientDoc);

    const baseModel: UMLModel = {
      version: '4.0.0',
      id: 'doc-1',
      title: 'Diagram',
      type: 'ClassDiagram',
      nodes: [
        {
          id: 'node-1',
          type: 'class' as DiagramNodeType,
          position: { x: 0, y: 0 },
          width: 100,
          height: 80,
          measured: { width: 100, height: 80 },
          data: { name: 'Cliente' },
        },
        {
          id: 'node-2',
          type: 'class' as DiagramNodeType,
          position: { x: 0, y: 0 },
          width: 100,
          height: 80,
          measured: { width: 100, height: 80 },
          data: { name: 'Cita' },
        }
      ],
      edges: [],
      assessments: {},
    };

    const merged = applyVisualStateToModel(baseModel, visualSnapshot);

    const clientNode1 = merged.nodes.find(n => n.id === 'node-1');
    const clientNode2 = merged.nodes.find(n => n.id === 'node-2');

    expect(clientNode1?.position).toEqual({ x: 300, y: 450 });
    expect(clientNode2?.position).toEqual({ x: 100, y: 150 });
  });
});
