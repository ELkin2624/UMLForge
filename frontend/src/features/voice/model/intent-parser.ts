import { UMLCommand } from './types';
import { normalizeCommandText, capitalizeClassName } from './normalization';
import { parseAttributeList } from './attribute-parser';

export interface ParsedIntentResult {
  commands: UMLCommand[];
  warnings: string[];
  disambiguationPrompt?: string;
  truncatedClauseCount?: number;
}

/**
 * Helper para extraer multiplicidades de relación UML
 */
function parseMultiplicities(str: string): { src: string; tgt: string } {
  if (str.includes('1 a 1')) return { src: '1', tgt: '1' };
  if (str.includes('* a *')) return { src: '*', tgt: '*' };
  if (str.includes('* a 1')) return { src: '*', tgt: '1' };
  if (str.includes('1 a *')) return { src: '1', tgt: '*' };
  if (str.includes('0..1')) return { src: '0..1', tgt: '*' };
  if (str.includes('1..*')) return { src: '1', tgt: '1..*' };
  return { src: '1', tgt: '*' };
}

function splitIntoClauses(normalizedText: string): string[] {
  const clean = normalizedText
    .replace(/\.{2,}/g, ' ') 
    .replace(/[.!?]+/g, ' | ') 
    .replace(/,\s*(?:luego|además|después|también|y|e)\b/gi, ' | ')
    .replace(/\b(?:luego|además|después|también)\b/gi, ' | ')
    .replace(/,\s*(?=(?:crea|agrega|añade|elimina|borra|renombra|relaciona|conecta|asocia|compone|conforma|posee|contiene|hereda|extiende|implementa|depende)\b)/gi, ' | ')
    .replace(/\s+\b(?:y|e)\b\s+(?=(?:crea|agrega|añade|elimina|borra|renombra|relaciona|conecta|asocia|compone|conforma|posee|contiene|hereda|extiende|implementa|depende)\b)/gi, ' | ');

  return clean
    .split('|')
    .map(p => p.trim())
    .filter(Boolean);
}

/**
 * Parser multi-cláusula robusto con máquina de estados contextual y regla de desambiguación.
 * Cumple con F12.13 §4 y §5 (sin LLM, 100% determinista).
 */
export function parseIntentStructured(text: string, initialContext?: string): ParsedIntentResult {
  console.log('[IntentParser] Raw input:', text);
  const normalized = normalizeCommandText(text);
  console.log('[IntentParser] Normalized:', normalized);
  const rawClauses = splitIntoClauses(normalized);
  console.log('[IntentParser] Clauses:', rawClauses);

  const warnings: string[] = [];
  const commands: UMLCommand[] = [];
  let disambiguationPrompt: string | undefined = undefined;

  // Límite de 3 cláusulas por fragmento (F12.13 §4.2)
  const MAX_CLAUSES = 3;
  let clauses = rawClauses;
  let truncatedClauseCount = 0;

  if (rawClauses.length > MAX_CLAUSES) {
    truncatedClauseCount = rawClauses.length - MAX_CLAUSES;
    clauses = rawClauses.slice(0, MAX_CLAUSES);
    warnings.push(
      "Detecté más de una idea en lo que dijiste; procesé las primeras 3, repite el resto por separado."
    );
  }

  // Máquina de estados: rastreo de clases y contexto
  let currentContextClass: string | null = initialContext ? capitalizeClassName(initialContext) : null;
  const classesMentioned: string[] = initialContext ? [capitalizeClassName(initialContext)] : [];

  for (const clause of clauses) {
    // ── 1. Creación de Clase ────────────────────────────────────────────────
    // Ej: "crea una clase llamada Cliente con nombre string y edad entero"
    // Ej: "crea una tabla con el nombre 'Rol' con atributos..."
    // Ej: "crea la entidad Pedido"
    // Ej: "crea la clase de Teoria con atributos..." (con prep. "de")
    // Ej: "crea la clase Pedido que tenga id entero"
    const STOP_WORDS = new Set([
      'con', 'de', 'del', 'la', 'el', 'las', 'los', 'un', 'una', 'para',
      'tabla', 'tablas', 'clase', 'clases', 'entidad', 'entidades', 'que', 'en', 'nombre'
    ]);

    const createClassMatch = clause.match(
      /(?:crea|gener)\s+(?:(?:una|la|el|las|los)\s+)?(?:clases?|entidades?|tablas?)\s+(?:de\s+|para\s+|del\s+|llamad[oa]s?\s+(?:de\s+)?|con\s+(?:el\s+)?nombre\s+(?:de\s+)?|titulad[oa]\s+)?([\wáéíóúüñÁÉÍÓÚÜÑ]+)(?:\s+(?:que\s+)?(?:con\s+)?(?:tenga[ns]?\s+)?(.*))?/i
    ) || clause.match(
      /^crea\s+([\wáéíóúüñÁÉÍÓÚÜÑ]+)(?:\s+(.*))?$/i
    );

    if (createClassMatch) {
      let rawClassName = createClassMatch[1];
      let rest = createClassMatch[2] || '';

      // Si por backtracking se capturó una stop word como "con" o "de", buscar el nombre real en el resto
      if (STOP_WORDS.has(rawClassName.toLowerCase())) {
        const words = rest.trim().split(/\s+/);
        const validIdx = words.findIndex(w => !STOP_WORDS.has(w.toLowerCase().replace(/[^a-zA-Z0-9_áéíóúüñÁÉÍÓÚÜÑ]/g, '')));
        if (validIdx !== -1) {
          rawClassName = words[validIdx];
          rest = words.slice(validIdx + 1).join(' ');
        }
      }

      if (!STOP_WORDS.has(rawClassName.toLowerCase())) {
        console.log('[IntentParser] Matched CREATE_CLASS:', rawClassName, 'Rest:', rest);
        const className = capitalizeClassName(rawClassName);
        commands.push({ type: 'CREATE_CLASS', className });
        
        currentContextClass = className;
        if (!classesMentioned.includes(className)) {
          classesMentioned.push(className);
        }

        if (rest) {
          // Ignorar si el "rest" empieza con palabras de enlace sin atributos
          const cleanRest = rest.replace(/^(?:que\s+)?(?:tenga[ns]?\s+)?(?:con\s+)?(?:(?:los|el|un)\s+)?(?:atributos?|campos?|propiedades?)\s+/i, '').trim();
          if (cleanRest) {
            const attrs = parseAttributeList(cleanRest);
            for (const attr of attrs) {
              commands.push({
                type: 'ADD_ATTRIBUTE',
                className,
                attributeName: attr.name,
                attributeType: attr.type
              });
            }
          }
        }
        continue;
      }
    }

    // ── 2. Eliminación de Clase ─────────────────────────────────────────────
    const deleteMatch = clause.match(/(?:elimina|borra|quita)\s+(?:(?:la|una)\s+)?(?:clase\s+)?([a-zA-Z0-9_áéíóú]+)/i);
    if (deleteMatch) {
      const targetClass = capitalizeClassName(deleteMatch[1]);
      commands.push({ type: 'DELETE_CLASS', className: targetClass });
      if (currentContextClass === targetClass) {
        currentContextClass = null;
      }
      continue;
    }

    // ── 3. Renombrar Clase ──────────────────────────────────────────────────
    const renameMatch = clause.match(
      /(?:renombra|cambia el nombre de)\s+(?:(?:la|una)\s+clase\s+)?([a-zA-Z0-9_áéíóú]+)\s+(?:a|como|por)\s+([a-zA-Z0-9_áéíóú]+)/i
    );
    if (renameMatch) {
      const oldName = capitalizeClassName(renameMatch[1]);
      const newName = capitalizeClassName(renameMatch[2]);
      commands.push({
        type: 'RENAME_CLASS',
        oldClassName: oldName,
        newClassName: newName
      });
      if (currentContextClass === oldName) {
        currentContextClass = newName;
      }
      continue;
    }

    // ── 4. Relaciones UML (Herencia, Composición, Agregación, Realización, Dependencia, Asociación, Autorreferenciada) ──
    const mults = parseMultiplicities(clause);

    // 4.1 Autorreferenciada
    const selfMatch = clause.match(
      /(?:relaciona|conecta|asocia)\s+(?:(?:la|una)\s+clase\s+)?([a-zA-Z0-9_áéíóú]+)\s+(?:consigo\s+misma|autorreferenciad[oa]|reflexiv[oa])/i
    );
    if (selfMatch) {
      const cls = capitalizeClassName(selfMatch[1]);
      commands.push({
        type: 'CREATE_RELATIONSHIP',
        sourceClass: cls,
        targetClass: cls,
        relationshipType: 'ASSOCIATION',
        sourceMultiplicity: mults.src,
        targetMultiplicity: mults.tgt
      });
      continue;
    }

    // 4.2 Herencia / Generalización
    const inheritsMatch = clause.match(
      /^([a-zA-Z0-9_áéíóú]+)\s+(?:hereda\s+(?:de\s+)?|extiende\s+(?:a\s+)?|es\s+un[a]?\s+subclase\s+de\s+|es\s+un[a]?\s+)(?:la\s+clase\s+)?([a-zA-Z0-9_áéíóú]+)$/i
    ) || clause.match(
      /(?:herencia|generalizaci[oó]n)\s+(?:entre\s+)?([a-zA-Z0-9_áéíóú]+)\s+(?:y|con)\s+([a-zA-Z0-9_áéíóú]+)/i
    );
    if (inheritsMatch) {
      commands.push({
        type: 'CREATE_RELATIONSHIP',
        sourceClass: capitalizeClassName(inheritsMatch[1]),
        targetClass: capitalizeClassName(inheritsMatch[2]),
        relationshipType: 'GENERALIZATION',
        sourceMultiplicity: '1',
        targetMultiplicity: '1'
      });
      continue;
    }

    // 4.3 Realización / Interfaz
    const realizesMatch = clause.match(
      /^([a-zA-Z0-9_áéíóú]+)\s+(?:implementa|realiza)\s+(?:(?:la|una)\s+interfaz\s+)?([a-zA-Z0-9_áéíóú]+)$/i
    );
    if (realizesMatch) {
      commands.push({
        type: 'CREATE_RELATIONSHIP',
        sourceClass: capitalizeClassName(realizesMatch[1]),
        targetClass: capitalizeClassName(realizesMatch[2]),
        relationshipType: 'REALIZATION',
        sourceMultiplicity: '1',
        targetMultiplicity: '1'
      });
      continue;
    }

    // 4.4 Dependencia
    const dependsMatch = clause.match(
      /^([a-zA-Z0-9_áéíóú]+)\s+(?:depende\s+de|utiliza\s+a|usa\s+a)\s+([a-zA-Z0-9_áéíóú]+)$/i
    );
    if (dependsMatch) {
      commands.push({
        type: 'CREATE_RELATIONSHIP',
        sourceClass: capitalizeClassName(dependsMatch[1]),
        targetClass: capitalizeClassName(dependsMatch[2]),
        relationshipType: 'DEPENDENCY',
        sourceMultiplicity: '1',
        targetMultiplicity: '1'
      });
      continue;
    }

    // 4.5 Composición (SVO y VSO: "Auto está compuesto por Motor", "composición entre Auto y Motor", "Auto compone Motor")
    const compMatch = clause.match(
      /^([a-zA-Z0-9_áéíóú]+)\s+(?:est[aá]\s+compuest[oa]\s+(?:por|de)|compone|conforma|est[aá]\s+integrad[oa]\s+por)\s+([a-zA-Z0-9_áéíóú]+)$/i
    ) || clause.match(
      /(?:composici[oó]n|est[aá]\s+compuest[oa]\s+(?:por|de)|compone|conforma|integrad[oa]\s+por)\s+(?:entre\s+)?([a-zA-Z0-9_áéíóú]+)\s+(?:y|con)\s+([a-zA-Z0-9_áéíóú]+)/i
    );
    if (compMatch) {
      commands.push({
        type: 'CREATE_RELATIONSHIP',
        sourceClass: capitalizeClassName(compMatch[1]),
        targetClass: capitalizeClassName(compMatch[2]),
        relationshipType: 'COMPOSITION',
        sourceMultiplicity: mults.src,
        targetMultiplicity: mults.tgt
      });
      continue;
    }

    // 4.6 Agregación (SVO y VSO: "Depto posee Empleado", "agregación entre Depto y Empleado")
    const aggrMatch = clause.match(
      /^([a-zA-Z0-9_áéíóú]+)\s+(?:posee|contiene|agrega)\s+([a-zA-Z0-9_áéíóú]+)$/i
    ) || clause.match(
      /(?:agregaci[oó]n|agrega|posee|contiene)\s+(?:entre\s+)?([a-zA-Z0-9_áéíóú]+)\s+(?:y|con)\s+([a-zA-Z0-9_áéíóú]+)/i
    );
    if (aggrMatch) {
      commands.push({
        type: 'CREATE_RELATIONSHIP',
        sourceClass: capitalizeClassName(aggrMatch[1]),
        targetClass: capitalizeClassName(aggrMatch[2]),
        relationshipType: 'AGGREGATION',
        sourceMultiplicity: mults.src,
        targetMultiplicity: mults.tgt
      });
      continue;
    }

    // 4.7 Asociación Explícita con 2 clases (ej: "relaciona Cliente con Pedido", "Cliente pertenece a Pedido")
    const rel2Match = clause.match(
      /^(?:relaciona|conecta|asocia|vincula)\s+(?:(?:\* a \*|1 a \*|\* a 1|1 a 1|0\.\.1|1\.\.\*|0\.\.\*)\s+)?(?:(?:la|una|el)\s+)?(?:clase|tabla|entidad\s+)?([a-zA-Z0-9_áéíóú]+)\s+(?:con|y|a)\s+(?:(?:la|una|el)\s+)?(?:clase|tabla|entidad\s+)?([a-zA-Z0-9_áéíóú]+)/i
    ) || clause.match(
      /(?:es\s+relacionada\s+con\s+|relacionada\s+con\s+)([a-zA-Z0-9_áéíóú]+)\s+donde\s+(?:un|una)?\s+([a-zA-Z0-9_áéíóú]+)\s+(?:pertenece\s+a)/i
    ) || clause.match(
      /^([a-zA-Z0-9_áéíóú]+)\s+(?:pertenece\s+a|est[aá]\s+asociad[oa]\s+con|est[aá]\s+vinculad[oa]\s+a|es\s+relacionada\s+con)\s+([a-zA-Z0-9_áéíóú]+)/i
    );
    if (rel2Match) {
      let source = rel2Match[1];
      let target = rel2Match[2];
      if (clause.includes("donde")) {
        source = rel2Match[2];
        target = rel2Match[1];
      }
      commands.push({
        type: 'CREATE_RELATIONSHIP',
        sourceClass: capitalizeClassName(source),
        targetClass: capitalizeClassName(target),
        relationshipType: 'ASSOCIATION',
        sourceMultiplicity: mults.src,
        targetMultiplicity: mults.tgt
      });
      continue;
    }

    // 4.8 Relación Contextual con 1 clase (ej: "relaciona con Pedido", "relaciona * a * a la tabla Usuario")
    const relContextMatch = clause.match(
      /^(?:relaciona|conecta|asocia|vincula)\s+(?:(?:\* a \*|1 a \*|\* a 1|1 a 1|0\.\.1|1\.\.\*|0\.\.\*)\s+)?(?:con|a)\s+(?:(?:la|una|el)\s+)?(?:clase|tabla|entidad)?\s*([a-zA-Z0-9_áéíóú]+)/i
    ) || clause.match(
      /^(?:relaciona|conecta|asocia|vincula)\s+(?:con\s+|a\s+)?(?:(?:la|una|el)\s+)?(?:clase|tabla|entidad)?\s*([a-zA-Z0-9_áéíóú]+)$/i
    );
    if (relContextMatch) {
      const targetClass = capitalizeClassName(relContextMatch[1]);
      
      // REGLA DE DESAMBIGUACIÓN (F12.13 §4.3)
      if (!currentContextClass) {
        if (classesMentioned.length > 1) {
          disambiguationPrompt = `¿A qué clase te refieres: ${classesMentioned.join(' o ')}?`;
          warnings.push(disambiguationPrompt);
        } else {
          warnings.push(`No se pudo determinar la clase origen para la relación con ${targetClass}.`);
        }
      } else {
        commands.push({
          type: 'CREATE_RELATIONSHIP',
          sourceClass: currentContextClass,
          targetClass: targetClass,
          relationshipType: 'ASSOCIATION',
          sourceMultiplicity: mults.src,
          targetMultiplicity: mults.tgt
        });
      }
      continue;
    }

    // ── 5. Agregar Atributos (Explícito o Contextual) ────────────────────────
    // 5.1 Explícito a una clase nombrada (ej: "agrega a Cliente el atributo email string")
    const addAttrExplicitMatch = clause.match(
      /(?:agrega|añade|ponle)\s+(?:a|en)\s+(?:(?:la|una)\s+clase\s+)?([a-zA-Z0-9_áéíóú]+)\s+(.*)/i
    );
    if (addAttrExplicitMatch) {
      const targetClass = capitalizeClassName(addAttrExplicitMatch[1]);
      const attrs = parseAttributeList(addAttrExplicitMatch[2]);
      for (const attr of attrs) {
        commands.push({
          type: 'ADD_ATTRIBUTE',
          className: targetClass,
          attributeName: attr.name,
          attributeType: attr.type
        });
      }
      currentContextClass = targetClass;
      continue;
    }

    // 5.2 Contextual (ej: "agrega precio float", "con atributo email string", "atributo telefono string")
    const addAttrContextMatch = clause.match(
      /(?:(?:agrega|con)\s+)?(?:(?:los|el|un)\s+)?(?:atributos?|campos?|propiedades?)\s+(.*)/i
    ) || clause.match(
      /^agrega\s+(.*)/i
    );

    if (addAttrContextMatch) {
      const attrContent = addAttrContextMatch[1];
      const attrs = parseAttributeList(attrContent);

      // DESAMBIGUACIÓN (F12.13 §4.3)
      if (!currentContextClass) {
        if (classesMentioned.length > 1) {
          disambiguationPrompt = `¿A qué clase te refieres: ${classesMentioned.join(' o ')}?`;
          warnings.push(disambiguationPrompt);
        } else {
          warnings.push("No se encontró una clase activa para agregar los atributos.");
        }
      } else {
        for (const attr of attrs) {
          commands.push({
            type: 'ADD_ATTRIBUTE',
            className: currentContextClass,
            attributeName: attr.name,
            attributeType: attr.type
          });
        }
      }
      continue;
    }

    // ── 6. Contexto "que tenga/tengas atributos" ─────────────────────────────
    // Whisper a veces separa "crea la clase X" de "que tenga nombre string" en
    // fragmentos distintos. Si llega como cláusula suelta, se asocia al contexto.
    const tengatMatch = clause.match(
      /(?:que\s+)?tenga[sn]?\s+(?:(?:los|el|un)\s+)?(?:atributos?|campos?)?\s*(.*)/i
    );
    if (tengatMatch) {
      const attrContent = tengatMatch[1].trim();
      const attrs = parseAttributeList(attrContent);
      if (attrs.length > 0) {
        if (!currentContextClass) {
          warnings.push("No se encontró una clase activa para agregar los atributos.");
        } else {
          for (const attr of attrs) {
            commands.push({
              type: 'ADD_ATTRIBUTE',
              className: currentContextClass,
              attributeName: attr.name,
              attributeType: attr.type
            });
          }
        }
        continue;
      }
    }
    // Cláusula no reconocida — no se añade warning para no saturar el UI
  }

  return {
    commands: sortCommandsByDependency(commands),
    warnings,
    disambiguationPrompt,
    truncatedClauseCount
  };
}

/**
 * Parser de intención para compatibilidad con firmas existentes.
 */
export function parseIntent(text: string): UMLCommand[] {
  const result = parseIntentStructured(text);
  return result.commands;
}

/**
 * Ordena los comandos para que las creaciones ocurran primero.
 */
function sortCommandsByDependency(commands: UMLCommand[]): UMLCommand[] {
  const priority = {
    'CREATE_CLASS': 1,
    'CREATE_NESTED_CLASS': 2,
    'ADD_ATTRIBUTE': 3,
    'ADD_OPERATION': 3,
    'RENAME_CLASS': 4,
    'CREATE_RELATIONSHIP': 5,
    'REMOVE_ATTRIBUTE': 6,
    'REMOVE_OPERATION': 6,
    'DELETE_CLASS': 7
  };

  return commands.sort((a, b) => priority[a.type] - priority[b.type]);
}
