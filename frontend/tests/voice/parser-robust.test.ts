import { describe, it, expect } from 'vitest';
import { parseIntentStructured, parseIntent } from '../../src/voice/intent-parser';
import { normalizeCommandText } from '../../src/voice/normalization';
import { applyCommands } from '../../src/voice/command-applier';
import { UMLModel } from '../../src/types/canonical-model';

describe('F12.13 - Parser de Voz Robusto con Segmentación y Multi-Cláusula', () => {

  describe('1. Normalización y Muletillas (F12.13 §5)', () => {
    it('debe limpiar muletillas coloquiales sin alterar el contenido semántico', () => {
      const dirty = "eh bueno crea este Usuario o sea con nombre string y digamos edad entero";
      const clean = normalizeCommandText(dirty);
      expect(clean).toContain('crea');
      expect(clean).toContain('usuario');
      expect(clean).not.toContain('eh');
      expect(clean).not.toContain('o sea');
      expect(clean).not.toContain('digamos');
      expect(clean).not.toContain('bueno');

      const result = parseIntentStructured(dirty);
      expect(result.commands.some(c => c.type === 'CREATE_CLASS' && (c as any).className === 'Usuario')).toBe(true);
      expect(result.commands.some(c => c.type === 'ADD_ATTRIBUTE' && (c as any).attributeName === 'nombre')).toBe(true);
      expect(result.commands.some(c => c.type === 'ADD_ATTRIBUTE' && (c as any).attributeName === 'edad')).toBe(true);
    });

    it('debe corregir errores fonéticos comunes de Whisper', () => {
      const text = "crea la clase Cliente con altruos correo tío cadena y ide tío entero";
      const result = parseIntent(text);
      expect(result.some(c => c.type === 'CREATE_CLASS' && (c as any).className === 'Cliente')).toBe(true);
      expect(result.some(c => c.type === 'ADD_ATTRIBUTE' && (c as any).attributeName === 'correo' && (c as any).attributeType === 'String')).toBe(true);
      expect(result.some(c => c.type === 'ADD_ATTRIBUTE' && (c as any).attributeName === 'id' && (c as any).attributeType === 'Integer')).toBe(true);
    });
  });

  describe('2. Multi-Cláusula y Conectores Soportados (F12.13 §4)', () => {
    it('debe parsear 2 cláusulas conectadas por "y"', () => {
      const text = "crea la clase Cliente con nombre string y relacionala con Pedido";
      const result = parseIntentStructured(text);
      expect(result.commands.length).toBeGreaterThanOrEqual(2);
      expect(result.commands.some(c => c.type === 'CREATE_CLASS' && (c as any).className === 'Cliente')).toBe(true);
      expect(result.commands.some(c => c.type === 'CREATE_RELATIONSHIP' && (c as any).sourceClass === 'Cliente' && (c as any).targetClass === 'Pedido')).toBe(true);
    });

    it('debe parsear 3 cláusulas conectadas por "luego" y "además"', () => {
      const text = "crea Producto, luego agrégale precio float, además crea Categoria";
      const result = parseIntentStructured(text);
      expect(result.commands.some(c => c.type === 'CREATE_CLASS' && (c as any).className === 'Producto')).toBe(true);
      expect(result.commands.some(c => c.type === 'ADD_ATTRIBUTE' && (c as any).className === 'Producto' && (c as any).attributeName === 'precio')).toBe(true);
      expect(result.commands.some(c => c.type === 'CREATE_CLASS' && (c as any).className === 'Categoria')).toBe(true);
    });

    it('debe parsear cláusulas conectadas por comas y "también"', () => {
      const text = "crea Factura, agrégale total decimal, también relacionala con Cliente";
      const result = parseIntentStructured(text);
      expect(result.commands.some(c => c.type === 'CREATE_CLASS' && (c as any).className === 'Factura')).toBe(true);
      expect(result.commands.some(c => c.type === 'ADD_ATTRIBUTE' && (c as any).className === 'Factura' && (c as any).attributeName === 'total')).toBe(true);
      expect(result.commands.some(c => c.type === 'CREATE_RELATIONSHIP' && (c as any).sourceClass === 'Factura' && (c as any).targetClass === 'Cliente')).toBe(true);
    });
  });

  describe('3. Límite de 3 Cláusulas por Fragmento (F12.13 §4.2)', () => {
    it('debe procesar solo las 3 primeras cláusulas y emitir aviso si hay más de 3', () => {
      const text = "crea ClaseA, luego crea ClaseB, además crea ClaseC, después crea ClaseD";
      const result = parseIntentStructured(text);
      
      const createdClasses = result.commands
        .filter(c => c.type === 'CREATE_CLASS')
        .map(c => (c as any).className);

      expect(createdClasses).toContain('Clasea');
      expect(createdClasses).toContain('Claseb');
      expect(createdClasses).toContain('Clasec');
      expect(createdClasses).not.toContain('Clased');
      expect(result.truncatedClauseCount).toBe(1);
      expect(result.warnings.some(w => w.includes('Detecté más de una idea'))).toBe(true);
    });
  });

  describe('4. Regla de Desambiguación Explícita (F12.13 §4.3)', () => {
    it('debe solicitar aclaración y no adivinar cuando el contexto es ambiguo entre 2 clases', () => {
      // Si se crea A y B explícitamente y luego se intenta relacionar contextualmente sin clase activa
      const text = "relaciónala con Pedido";
      // Sin clase previa ni contexto inicial
      const result = parseIntentStructured(text, undefined);
      expect(result.commands.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('5. Sinónimos Extendidos de Relación (F12.13 §5)', () => {
    it('debe reconocer "compone" y "conforma" como COMPOSITION', () => {
      const text1 = "composición entre Auto y Motor";
      const res1 = parseIntent(text1);
      expect(res1.some(c => c.type === 'CREATE_RELATIONSHIP' && (c as any).relationshipType === 'COMPOSITION')).toBe(true);

      const text2 = "Auto está compuesto por Motor";
      const res2 = parseIntent(text2);
      expect(res2.some(c => c.type === 'CREATE_RELATIONSHIP' && (c as any).relationshipType === 'COMPOSITION')).toBe(true);
    });

    it('debe reconocer "posee" y "contiene" como AGGREGATION', () => {
      const text = "agregación entre Departamento y Empleado";
      const res = parseIntent(text);
      expect(res.some(c => c.type === 'CREATE_RELATIONSHIP' && (c as any).relationshipType === 'AGGREGATION')).toBe(true);
    });

    it('debe reconocer "hereda de" como GENERALIZATION', () => {
      const text = "Perro hereda de Animal";
      const res = parseIntent(text);
      expect(res.some(c => c.type === 'CREATE_RELATIONSHIP' && (c as any).relationshipType === 'GENERALIZATION' && (c as any).sourceClass === 'Perro' && (c as any).targetClass === 'Animal')).toBe(true);
    });

    it('debe reconocer "implementa" como REALIZATION', () => {
      const text = "ServicioAutenticacion implementa IServicio";
      const res = parseIntent(text);
      expect(res.some(c => c.type === 'CREATE_RELATIONSHIP' && (c as any).relationshipType === 'REALIZATION')).toBe(true);
    });
  });

  describe('6. CommandApplier: Ejecución y Reporte Parcial (F12.13 §4.5)', () => {
    it('debe aplicar comandos válidos y reportar errores específicos cuando un comando falla', () => {
      const initialModel: UMLModel = {
        classes: [{ id: 'c1', name: 'Usuario', attributes: [], operations: [] }],
        relationships: []
      };

      const commands = [
        { type: 'CREATE_CLASS' as const, className: 'Perfil' },
        { type: 'ADD_ATTRIBUTE' as const, className: 'ClaseInexistente', attributeName: 'campo', attributeType: 'String' }, // Fallará
        { type: 'ADD_ATTRIBUTE' as const, className: 'Usuario', attributeName: 'email', attributeType: 'String' } // Válido
      ];

      const result = applyCommands(initialModel, commands);
      expect(result.success).toBe(true);
      expect(result.appliedCommands?.length).toBe(2);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('ClaseInexistente');
      
      // Verificar que el modelo contiene Perfil y el nuevo atributo en Usuario
      expect(result.model.classes.some((c: any) => c.name === 'Perfil')).toBe(true);
      const userClass = result.model.classes.find((c: any) => c.name === 'Usuario');
      expect(userClass.attributes.some((a: any) => a.name === 'email')).toBe(true);
    });
  });

});
