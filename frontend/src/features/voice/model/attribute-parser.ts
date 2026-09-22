import { mapTypeToUML } from './type-mapper';

export interface ParsedAttribute {
  name: string;
  type: string;
}

/**
 * Analiza un bloque de texto que contiene una lista de atributos y extrae 
 * sus nombres y tipos. Soporta separación por comas, "y", y espacios,
 * así como declaración de tipos implícitos y explícitos.
 */
export function parseAttributeList(text: string): ParsedAttribute[] {
  const attributes: ParsedAttribute[] = [];
  
  // Limpiar conectores basura comunes al inicio del bloque de atributos
  let cleanText = text
    .replace(/^(?:con\s+)?(?:(?:los|el|un)\s+)?(?:siguientes\s+)?(?:atributos?|campos?|propiedades?|columnas?)\s*:?\s*/i, '')
    .replace(/^con\s+/i, '')
    .trim();

  // Dividir por comas, " y ", o " e "
  // Ej: "nombre tipo cadena, edad tipo entero y activo tipo booleano"
  const tokens = cleanText.split(/,|\b(?:y|e)\b/).map(t => t.trim()).filter(Boolean);

  for (const token of tokens) {
    // Patrón 1: explícito "nombre (de) tipo X"
    let match = token.match(/([a-zA-Z0-9_áéíóú]+)\s+(?:de\s+)?tipo\s+([a-zA-Z0-9_áéíóú]+(?: \w+)?)/i);
    if (match) {
      attributes.push({
        name: match[1],
        type: mapTypeToUML(match[2])
      });
      continue;
    }

    // Patrón 2: implícito "nombre string" o "edad int"
    // Dos palabras contiguas donde asumimos que la primera es el nombre y la segunda el tipo
    match = token.match(/^([a-zA-Z0-9_áéíóú]+)\s+([a-zA-Z0-9_áéíóú]+)$/i);
    if (match) {
      // Para evitar que palabras como "un atributo" se procesen mal, 
      // verificaremos si la primera palabra no es un artículo
      const w1 = match[1].toLowerCase();
      if (!['un', 'una', 'el', 'la', 'los', 'las'].includes(w1)) {
        attributes.push({
          name: match[1],
          type: mapTypeToUML(match[2])
        });
        continue;
      }
    }

    // Patrón 3: solo nombre (tipo por defecto String)
    // Puede contener "un campo nombre" -> extraemos "nombre"
    match = token.match(/(?:un\s+campo\s+|una\s+propiedad\s+|un\s+atributo\s+)?([a-zA-Z0-9_áéíóú]+)/i);
    if (match) {
      attributes.push({
        name: match[1],
        type: mapTypeToUML('String')
      });
    }
  }

  return attributes;
}
