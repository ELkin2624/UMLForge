/**
 * Mapeo inteligente de tipos de datos a tipos UML canónicos.
 * Soporta errores de transcripción de Whisper y sinónimos comunes en español.
 */
export function mapTypeToUML(rawType: string): string {
  if (!rawType) return 'String';
  
  const normalized = rawType.toLowerCase().trim();

  // String / Text
  if (/cadena|texto|string|str|varchar|char/.test(normalized)) return 'String';

  // Integer
  if (/entero|int|integer|número entero/.test(normalized)) return 'Integer';

  // Double / Float / Decimal
  if (/decimal|double|float|número decimal|real/.test(normalized)) return 'Double';

  // Long
  if (/largo|long|entero largo/.test(normalized)) return 'Long';

  // Boolean
  if (/booleano|bool|boolean|lógico|verdadero o falso/.test(normalized)) return 'Boolean';

  // Dates
  if (/fecha y hora|datetime|timestamp/.test(normalized)) return 'LocalDateTime';
  if (/fecha|date/.test(normalized)) return 'LocalDate';
  
  // Arrays/List
  if (/lista de|array|arreglo/.test(normalized)) return 'List';

  // Si no se reconoce, se devuelve normalizado (primera letra mayúscula)
  return rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
}
