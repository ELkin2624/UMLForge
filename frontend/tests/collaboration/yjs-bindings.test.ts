import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { createYjsDocument, setModelJson, getModelMap } from '../../src/collaboration/yjs-document';
import { bindYjsToStore } from '../../src/collaboration/yjs-bindings';
import { LOCAL_ORIGIN } from '../../src/collaboration/yjs-bindings';
import { useModelStore } from '../../src/store/model-store';
import type { UMLModel } from '../../src/types/canonical-model';

const makeEmptyModel = (name = 'TestModel'): UMLModel => ({
  name,
  classes: [],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
});

describe('yjs-bindings', () => {
  let doc: Y.Doc;
  let unbind: () => void;

  beforeEach(() => {
    doc = createYjsDocument();
    // Reset store antes de cada test
    useModelStore.getState().setModel(null);
    useModelStore.getState().resetCollaboration();
  });

  afterEach(() => {
    if (unbind) unbind();
    doc.destroy();
  });

  it('cambio en store.model → Y.Doc se actualiza con origen LOCAL_ORIGIN', () => {
    let capturedOrigin: unknown = null;
    doc.on('afterTransaction', (tr: Y.Transaction) => {
      if (tr.origin === LOCAL_ORIGIN) capturedOrigin = tr.origin;
    });

    unbind = bindYjsToStore(doc);

    const model = makeEmptyModel('Barbería');
    useModelStore.getState().setModel(model);

    expect(capturedOrigin).toBe(LOCAL_ORIGIN);
  });

  it('cambio en store con modelo null NO escribe en Y.Doc', () => {
    const model = makeEmptyModel();
    useModelStore.getState().setModel(model);
    unbind = bindYjsToStore(doc);

    let writeCount = 0;
    doc.on('afterTransaction', (tr: Y.Transaction) => {
      if (tr.origin === LOCAL_ORIGIN) writeCount++;
    });

    useModelStore.getState().setModel(null);
    expect(writeCount).toBe(0);
  });

  it('cambio en Y.Doc con origen REMOTO → store.model se actualiza', () => {
    unbind = bindYjsToStore(doc);

    const remoteModel = makeEmptyModel('Remote');
    const remoteJson = JSON.stringify(remoteModel);

    setModelJson(doc, remoteJson, 'remote-client-123');

    const storeModel = useModelStore.getState().model;
    expect(storeModel).not.toBeNull();
    expect(storeModel?.name).toBe('Remote');
  });

  it('cambio en Y.Doc con origen LOCAL_ORIGIN → store NO se actualiza (sin loop)', () => {
    const initialModel = makeEmptyModel('Initial');
    useModelStore.getState().setModel(initialModel);
    unbind = bindYjsToStore(doc);

    const setModelSpy = vi.spyOn(useModelStore.getState(), 'setModel');

    // Escribir con origen local — debe ser ignorado por el observer
    setModelJson(doc, JSON.stringify(makeEmptyModel('LocalWrite')), LOCAL_ORIGIN);

    // setModel no debe haberse llamado desde el observer de Yjs
    expect(setModelSpy).not.toHaveBeenCalled();
  });

  it('unbind cancela ambas suscripciones (store y Y.Doc)', () => {
    // Arranque: poner un modelo en el store
    const initial = makeEmptyModel('Initial');
    useModelStore.getState().setModel(initial);

    unbind = bindYjsToStore(doc);

    // Publicar el modelo inicial en Y.Doc (simular que el bind lo emitió)
    setModelJson(doc, JSON.stringify(initial), LOCAL_ORIGIN);

    // Desenlazar
    unbind();
    unbind = () => {}; // marcar como ya invocado

    // Cambiar el modelo en store — Y.Doc no debe actualizarse
    const yMapBefore = JSON.stringify([...getModelMap(doc).entries()]);
    useModelStore.getState().setModel(makeEmptyModel('AfterUnbind'));
    const yMapAfter = JSON.stringify([...getModelMap(doc).entries()]);
    expect(yMapAfter).toBe(yMapBefore); // sin cambios en Y.Doc

    // Cambiar en Y.Doc con origen remoto — store no debe actualizarse
    const storeBefore = useModelStore.getState().model?.name;
    setModelJson(doc, JSON.stringify(makeEmptyModel('RemoteAfterUnbind')), 'remote');
    const storeAfter = useModelStore.getState().model?.name;
    expect(storeAfter).toBe(storeBefore); // sin cambios en store
  });
});
