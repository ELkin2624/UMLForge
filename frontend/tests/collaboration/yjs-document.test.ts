import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  createYjsDocument,
  getModelMap,
  getModelJson,
  setModelJson,
} from '../../src/collaboration/yjs-document';

describe('yjs-document', () => {
  it('createYjsDocument retorna un Y.Doc válido', () => {
    const doc = createYjsDocument();
    expect(doc).toBeInstanceOf(Y.Doc);
    doc.destroy();
  });

  it('getModelMap retorna el mismo Y.Map en llamadas repetidas (idempotente)', () => {
    const doc = createYjsDocument();
    const map1 = getModelMap(doc);
    const map2 = getModelMap(doc);
    expect(map1).toBe(map2);
    doc.destroy();
  });

  it('getModelJson retorna undefined en un doc vacío', () => {
    const doc = createYjsDocument();
    expect(getModelJson(doc)).toBeUndefined();
    doc.destroy();
  });

  it('setModelJson escribe el JSON en el Y.Map', () => {
    const doc = createYjsDocument();
    const json = '{"classes":[],"relationships":[],"components":[],"interfaces":[],"diagrams":[]}';
    setModelJson(doc, json, 'umlforge-local');
    expect(getModelJson(doc)).toBe(json);
    doc.destroy();
  });

  it('setModelJson usa el origen especificado en la transacción', () => {
    const doc = createYjsDocument();
    let capturedOrigin: unknown = null;

    doc.on('afterTransaction', (tr: Y.Transaction) => {
      if (tr.origin === 'test-origin') capturedOrigin = tr.origin;
    });

    setModelJson(doc, '{"test":true}', 'test-origin');
    expect(capturedOrigin).toBe('test-origin');
    doc.destroy();
  });

  it('setModelJson sobrescribe el valor anterior', () => {
    const doc = createYjsDocument();
    setModelJson(doc, '"first"', 'local');
    setModelJson(doc, '"second"', 'local');
    expect(getModelJson(doc)).toBe('"second"');
    doc.destroy();
  });
});
