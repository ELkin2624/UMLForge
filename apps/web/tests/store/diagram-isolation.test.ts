import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../../src/store/model-store';
import { apollonToCanonical } from '../../src/adapters/apollon-adapter';
import { UMLModel as ApollonModel } from '@tumaet/apollon';

describe('Diagram Submodel Isolation & Persistence', () => {
  beforeEach(() => {
    useModelStore.getState().clearModel();
    useModelStore.getState().setDiagramType('class');
  });

  it('debería preservar clases y componentes al alternar entre diagramas (Aislamiento Total)', () => {
    // 1. En modo ClassDiagram: el usuario modela una clase "Cliente"
    const apollonClassState: ApollonModel = {
      version: '4.0.0',
      id: 'model-1',
      title: 'Sistema Mixto',
      type: 'ClassDiagram',
      nodes: [
        {
          id: 'cls-cliente-id',
          type: 'class',
          width: 200,
          height: 120,
          position: { x: 100, y: 100 },
          data: {
            name: 'Cliente',
            attributes: [{ id: 'attr-1', name: 'nombre: String' }],
            methods: [],
          },
          measured: { width: 200, height: 120 },
        },
      ],
      edges: [],
      assessments: {},
    };

    const initialCanonical = apollonToCanonical(apollonClassState);
    useModelStore.getState().setModel(initialCanonical);

    expect(useModelStore.getState().model?.classes).toHaveLength(1);
    expect(useModelStore.getState().model?.classes[0].name).toBe('Cliente');
    expect(useModelStore.getState().model?.components).toHaveLength(0);

    // 2. Cambiamos a ComponentDiagram en el store
    useModelStore.getState().setDiagramType('component');
    expect(useModelStore.getState().diagramType).toBe('component');

    // 3. En modo ComponentDiagram: el usuario modela un componente "BackendService"
    const apollonComponentState: ApollonModel = {
      version: '4.0.0',
      id: 'model-1',
      title: 'Sistema Mixto',
      type: 'ComponentDiagram',
      nodes: [
        {
          id: 'comp-backend-id',
          type: 'component',
          width: 200,
          height: 120,
          position: { x: 150, y: 150 },
          data: { name: 'BackendService' },
          measured: { width: 200, height: 120 },
        },
      ],
      edges: [],
      assessments: {},
    };

    // Al guardar el estado de componentes pasando el modelo previo del store:
    const updatedCanonical = apollonToCanonical(
      apollonComponentState,
      useModelStore.getState().model || undefined
    );
    useModelStore.getState().setModel(updatedCanonical);

    // Verificamos que ahora el modelo canónico tiene AMBOS: la clase Cliente y el componente BackendService
    const currentModel = useModelStore.getState().model;
    expect(currentModel?.classes).toHaveLength(1);
    expect(currentModel?.classes[0].name).toBe('Cliente');
    expect(currentModel?.classes[0].id).toBe('cls-cliente-id');

    expect(currentModel?.components).toHaveLength(1);
    expect(currentModel?.components[0].name).toBe('BackendService');
    expect(currentModel?.components[0].id).toBe('comp-backend-id');

    // 4. Volvemos al modo ClassDiagram
    useModelStore.getState().setDiagramType('class');

    // Comprobamos que el modelo canónico mantiene tanto Cliente como BackendService
    const finalModel = useModelStore.getState().model;
    expect(finalModel?.classes[0].name).toBe('Cliente');
    expect(finalModel?.components[0].name).toBe('BackendService');
  });
});
