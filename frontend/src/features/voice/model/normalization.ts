/**
 * Normaliza el texto extraído por Whisper o ingresado por el usuario,
 * corrigiendo errores de transcripción comunes y unificando el lenguaje.
 * Cumple con F12.13 (Normalización extendida y sinónimos sin LLM).
 */
export function normalizeCommandText(text: string): string {
  let normalized = text.trim().toLowerCase();

  // Remover puntuación innecesaria al final/inicio, pero mantenemos los puntos intermedios
  normalized = normalized.replace(/^[¡¿!?]+/, '').replace(/[¡¿!?]+$/, '').trim();

  // 0. Limpiar comillas simples, dobles o angulares que envuelven nombres
  normalized = normalized.replace(/['"«»]/g, ' ');

  // 1a. Eliminar frases de cortesía/subordinación ANTES de verbos de acción
  //     Ej: "quiero que crees" → "crees", "me gustaría que agregues" → "agregues"
  //     "para que tengas" → "tengas", "necesito que pongas" → "pongas"
  normalized = normalized.replace(
    /\b(?:quiero\s+que|me\s+gustar[íi]a\s+que|necesito\s+que|podr[íi]as|por\s+favor|que\s+tengas|para\s+que|si\s+puedes|haz\s+que)\s+/g,
    ''
  );

  // 1b. Eliminar muletillas coloquiales y saludos (F12.13 §5)
  normalized = normalized.replace(
    /\b(eh|este|o\s+sea|digamos|bueno|a\s+ver|pues|entonces|mira|oye|hola|gracias|por\s+favor)\b/g,
    ''
  );

  // 1c. Eliminar conectores subordinantes que preceden la acción
  //     Ej: "que crees la clase" → "crees la clase"
  normalized = normalized.replace(/^\s*(?:y\s+)?que\s+/g, '');

  // 1d. Frases hedging: "creo que" → "" (Whisper trascribe "crea" como "creo que")
  normalized = normalized.replace(/\bcreo\s+que\s+/g, 'crea ');

  // Eliminar palabras de orden ordinal que causan ruido
  normalized = normalized.replace(
    /\b(?:el\s+|la\s+|al\s+|en\s+el\s+|en\s+la\s+)?(?:primer|primera|segundo|segunda|tercer|tercera|cuarto|cuarta|quinto|quinta|sexto|sexta)\b/g,
    ''
  );

  // Limpiar conectores verbales redundantes
  normalized = normalized.replace(/\b(?:va\s+a\s+(?:ser|hacer|estar)|va\s+hacia\s+la)\b/g, 'es');

  // 2. Corregir errores fonéticos comunes de Whisper en español
  normalized = normalized.replace(/\b(altruos|atributos|atribu|propiedades|campos|attributeo|tributa|trayecto|tributado|tributo)\b/g, 'atributo');
  normalized = normalized.replace(/\btío\b/g, 'tipo');
  normalized = normalized.replace(/\b(llamada|llamado)\b/g, 'llamado');
  // Tipos de dato mal transcritos
  normalized = normalized.replace(/\b(ire|idea|ide)\b/g, 'id');
  normalized = normalized.replace(/\b(intero|interro|intel|int|integro)\b/g, 'entero');
  normalized = normalized.replace(/\b(volviano|boliano|boleano|boolean)\b/g, 'booleano');
  normalized = normalized.replace(/\b(caden[ae]|cadena|string|cadenas|char|caracter|carácter)\b/g, 'cadena');
  normalized = normalized.replace(/\b(doble|double|flota|flotante|flotación)\b/g, 'double');
  normalized = normalized.replace(/\b(flotante|float)\b/g, 'float');
  // Variaciones fonéticas y de concordancia de género
  normalized = normalized.replace(/\busuaria\b/g, 'usuario');

  // 3. Normalizar verbos de acción y pronombres enclíticos
  normalized = normalized.replace(
    /\b(crear|cree|crees|creen|crean|generar|genera|generes|generen|hacer|hagas|hagan|haz|nueva|nuevo|hacé|creá)\b/gi,
    'crea'
  );
  normalized = normalized.replace(
    /\b(agregar|añadir|añade|añádele|añadele|ponle|pónle|añádela|añadela|agrégale|agregale|metele|métele|incluye|inclúyele|incluyele|agrégame|agregame|ponme|pon|agreguen|añadan)\b/gi,
    'agrega'
  );
  normalized = normalized.replace(
    /\b(eliminar|borrar|borra|quita|quítale|quitale|remover|remueve|bórralo|bórrala|eliminen|borren|quiten)\b/gi,
    'elimina'
  );
  normalized = normalized.replace(
    /\b(renombrar|cambia\s+el\s+nombre\s+de|renómbrala|renombrala|cambiale\s+el\s+nombre|cámbiale\s+el\s+nombre|renombren)\b/gi,
    'renombra'
  );
  // Predicados verbales y participios de relación
  normalized = normalized.replace(
    /\b(tengo\s+una\s+conexi[oó]n|tiene\s+una\s+conexi[oó]n|con\s+conexi[oó]n|est[eé]\s+conectad[oa]|est[aá]\s+conectad[oa]|conectad[oa]|est[eé]\s+relacionad[oa]|est[aá]\s+relacionad[oa]|relacionad[oa]|est[eé]\s+asociad[oa]|est[aá]\s+asociad[oa]|asociad[oa]|est[eé]\s+vinculad[oa]|est[aá]\s+vinculad[oa]|vinculad[oa]|relacionar|relaciónalos|relacionalos|relaciónala|relacionala|relaciónalo|relacionalo|conecta|conéctala|conectala|conéctalo|conectalo|asocia|asóciala|asociala|vincula|vincúlala|vinculala|relacionen|conecten)\b/gi,
    'relaciona'
  );

  // 4. Normalizar multiplicidades (relaciones y errores fonéticos de Whisper)
  normalized = normalized.replace(/\b(n a m|n:m|n a n|n:n|m a m|m:m|muchos a muchos|muchos con muchos|mucho\s+jamucho|muchos\s+jamuchos|mucho\s+a\s+mucho|mucho\s+con\s+mucho|mucho\s+mucho|muchos\s+muchos)\b/g, '* a *');
  normalized = normalized.replace(/\b(uno a uno|1 a 1|1:1|uno con uno|cada uno tiene uno)\b/g, '1 a 1');
  normalized = normalized.replace(/\b(uno a muchos|1 a n|1:n|uno con muchos)\b/g, '1 a *');
  normalized = normalized.replace(/\b(muchos a uno|n a 1|n:1)\b/g, '* a 1');
  normalized = normalized.replace(/\b(cero o uno)\b/g, '0..1');
  normalized = normalized.replace(/\b(uno o muchos)\b/g, '1..*');
  normalized = normalized.replace(/\b(cero o muchos)\b/g, '0..*');
  // Nota: no normalizar "uno" a "1" de forma aislada porque puede ser parte de un nombre
  normalized = normalized.replace(/\bmuchos\b/g, '*');

  // Limpiar espacios dobles o repetidos
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Restaura el CamelCase o nombres propios usando una heurística simple
 * ya que lowerCase() destruye la capitalización de las clases.
 */
export function capitalizeClassName(name: string): string {
  if (!name) return '';
  const clean = name.replace(/['"«»\s]/g, '');
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}
