import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateModelStats,
  buildGenerationPreviewMessage,
  promptLocalOutputPath,
  downloadBlob,
} from './file-utils';
import { UMLModel } from '../../../types/canonical-model';

describe('file-utils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('calculateModelStats', () => {
    it('returns zeroes when model is undefined or null', () => {
      expect(calculateModelStats(undefined)).toEqual({
        classCount: 0,
        attrCount: 0,
        opCount: 0,
        relCount: 0,
      });
      expect(calculateModelStats(null)).toEqual({
        classCount: 0,
        attrCount: 0,
        opCount: 0,
        relCount: 0,
      });
    });

    it('calculates counts correctly for a complete model', () => {
      const mockModel: UMLModel = {
        id: 'test-model',
        name: 'TestModel',
        classes: [
          {
            id: 'c1',
            name: 'User',
            attributes: [
              { id: 'a1', name: 'id', type: 'Long' },
              { id: 'a2', name: 'email', type: 'String' },
            ],
            operations: [{ id: 'o1', name: 'login', return_type: 'boolean' }],
          },
          {
            id: 'c2',
            name: 'Role',
            attributes: [{ id: 'a3', name: 'name', type: 'String' }],
            operations: [],
          },
        ],
        relationships: [
          {
            id: 'r1',
            source_id: 'c1',
            target_id: 'c2',
            type: 'association',
          },
        ],
        components: [],
        interfaces: [],
        diagrams: [],
      };

      const stats = calculateModelStats(mockModel);
      expect(stats).toEqual({
        classCount: 2,
        attrCount: 3,
        opCount: 1,
        relCount: 1,
      });
    });
  });

  describe('buildGenerationPreviewMessage', () => {
    it('formats stats into the expected confirmation message', () => {
      const stats = { classCount: 2, attrCount: 3, opCount: 1, relCount: 1 };
      const message = buildGenerationPreviewMessage(stats);
      expect(message).toContain('Clases: 2');
      expect(message).toContain('Atributos: 3');
      expect(message).toContain('Operaciones: 1');
      expect(message).toContain('Relaciones: 1');
      expect(message).toContain('¿Deseas continuar?');
    });
  });

  describe('promptLocalOutputPath', () => {
    it('returns null if the user cancels prompt', () => {
      vi.spyOn(window, 'prompt').mockReturnValue(null);
      const result = promptLocalOutputPath();
      expect(result).toBeNull();
    });

    it('returns input path and persists in localStorage when provided', () => {
      vi.spyOn(window, 'prompt').mockReturnValue('D:\\Projects\\SpringBoot');
      const result = promptLocalOutputPath();
      expect(result).toBe('D:\\Projects\\SpringBoot');
      expect(localStorage.getItem('lastLocalOutputPath')).toBe('D:\\Projects\\SpringBoot');
    });

    it('uses stored path as default if previously saved', () => {
      localStorage.setItem('lastLocalOutputPath', 'E:\\Saved\\Path');
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('E:\\Saved\\Path');

      const result = promptLocalOutputPath();
      expect(promptSpy).toHaveBeenCalledWith(
        'Ruta de salida para el backend Spring Boot:',
        'E:\\Saved\\Path'
      );
      expect(result).toBe('E:\\Saved\\Path');
    });
  });

  describe('downloadBlob', () => {
    it('creates object URL and triggers anchor click and revocation', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test');
      const revokeObjectURLMock = vi.fn();
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = revokeObjectURLMock;

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      const blob = new Blob(['sample data'], { type: 'application/zip' });
      downloadBlob(blob, 'project.zip');

      expect(createObjectURLMock).toHaveBeenCalledWith(blob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/test');
    });
  });
});
