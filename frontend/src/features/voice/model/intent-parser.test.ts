import { describe, it, expect } from 'vitest';
import { parseIntentStructured } from './intent-parser';
import { normalizeCommandText } from './normalization';
import { mapTypeToUML } from './type-mapper';

describe('voice intent-parser & utilities', () => {
  describe('normalizeCommandText', () => {
    it('normalizes greetings and courtesy phrases', () => {
      const input = 'Hola por favor crea una clase Usuario';
      const output = normalizeCommandText(input);
      expect(output).toContain('crea');
      expect(output).toContain('usuario');
    });

    it('corrects common phonetic misunderstandings', () => {
      const input = 'crea clase Producto con propiedades nombre cadena y precio double';
      const output = normalizeCommandText(input);
      expect(output).toContain('atributo');
      expect(output).toContain('cadena');
      expect(output).toContain('double');
    });
  });

  describe('mapTypeToUML', () => {
    it('maps natural language types to standard UML types', () => {
      expect(mapTypeToUML('cadena')).toBe('String');
      expect(mapTypeToUML('entero')).toBe('Integer');
      expect(mapTypeToUML('booleano')).toBe('Boolean');
      expect(mapTypeToUML('flotante')).toBe('Double');
      expect(mapTypeToUML('fecha')).toBe('LocalDate');
    });
  });

  describe('parseIntentStructured', () => {
    it('parses CREATE_CLASS with attributes correctly', () => {
      const input = 'crea la clase Usuario con nombre tipo string y edad tipo entero';
      const result = parseIntentStructured(input);

      expect(result.commands).toHaveLength(3);
      expect(result.commands[0]).toEqual({
        type: 'CREATE_CLASS',
        className: 'Usuario',
      });
      expect(result.commands[1]).toEqual({
        type: 'ADD_ATTRIBUTE',
        className: 'Usuario',
        attributeName: 'nombre',
        attributeType: 'String',
      });
      expect(result.commands[2]).toEqual({
        type: 'ADD_ATTRIBUTE',
        className: 'Usuario',
        attributeName: 'edad',
        attributeType: 'Integer',
      });
    });

    it('parses CREATE_RELATIONSHIP correctly', () => {
      const input = 'relaciona Usuario con Pedido muchos a muchos';
      const result = parseIntentStructured(input);

      expect(result.commands.some((c) => c.type === 'CREATE_RELATIONSHIP')).toBe(true);
      const relCmd = result.commands.find((c) => c.type === 'CREATE_RELATIONSHIP') as any;
      expect(relCmd.sourceClass).toBe('Usuario');
      expect(relCmd.targetClass).toBe('Pedido');
      expect(relCmd.sourceMultiplicity).toBe('*');
      expect(relCmd.targetMultiplicity).toBe('*');
    });

    it('parses user text prompt with quotes and attached relation correctly', () => {
      const input = "crea una tabla con el nombre 'Rol' con los atributos Id de tipo entero y nombre de tipo char, y este conectada muchos a muchos a la tabla 'Usuario'";
      const result = parseIntentStructured(input);

      const createClassCmd = result.commands.find(c => c.type === 'CREATE_CLASS') as any;
      expect(createClassCmd).toBeDefined();
      expect(createClassCmd.className).toBe('Rol');
      expect(createClassCmd.className).not.toBe('Con');
      expect(createClassCmd.className).not.toBe('De');

      const idAttr = result.commands.find(c => c.type === 'ADD_ATTRIBUTE' && (c as any).attributeName.toLowerCase() === 'id') as any;
      expect(idAttr).toBeDefined();
      expect(idAttr.attributeType).toBe('Integer');

      const nombreAttr = result.commands.find(c => c.type === 'ADD_ATTRIBUTE' && (c as any).attributeName.toLowerCase() === 'nombre') as any;
      expect(nombreAttr).toBeDefined();
      expect(nombreAttr.attributeType).toBe('String');

      const relCmd = result.commands.find(c => c.type === 'CREATE_RELATIONSHIP') as any;
      expect(relCmd).toBeDefined();
      expect(relCmd.sourceClass).toBe('Rol');
      expect(relCmd.targetClass).toBe('Usuario');
      expect(relCmd.sourceMultiplicity).toBe('*');
      expect(relCmd.targetMultiplicity).toBe('*');
    });

    it('parses noisy voice input with "mucho jamucho" and "usuaria" correctly', () => {
      const input = "crea una tabla con el nombre de rol y tengo una conexion mucho jamucho con la tabla usuaria";
      const result = parseIntentStructured(input);

      const createClassCmd = result.commands.find(c => c.type === 'CREATE_CLASS') as any;
      expect(createClassCmd).toBeDefined();
      expect(createClassCmd.className).toBe('Rol');

      const relCmd = result.commands.find(c => c.type === 'CREATE_RELATIONSHIP') as any;
      expect(relCmd).toBeDefined();
      expect(relCmd.sourceClass).toBe('Rol');
      expect(relCmd.targetClass).toBe('Usuario');
      expect(relCmd.sourceMultiplicity).toBe('*');
      expect(relCmd.targetMultiplicity).toBe('*');
    });
  });
});
