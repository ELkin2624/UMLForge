import { UMLModel, UMLClass } from '../../../types/canonical-model';
import { UMLCommand, CommandResult } from './types';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

/**
 * Aplica una lista de comandos UML de forma secuencial sobre el modelo actual (F12.13 §4.5).
 * Cada comando se ejecuta de forma independiente; si uno falla, se conservan los comandos
 * anteriores válidos y se reporta exactamente qué comando falló.
 */
export function applyCommands(currentModel: UMLModel, commands: UMLCommand[]): CommandResult {
  const newModel: UMLModel = JSON.parse(JSON.stringify(currentModel));
  const warnings: string[] = [];
  const errors: string[] = [];
  const applied: UMLCommand[] = [];

  for (const cmd of commands) {
    try {
      applyCommand(newModel, cmd, warnings);
      applied.push(cmd);
    } catch (err: any) {
      errors.push(`Error en comando ${cmd.type}: ${err.message}`);
    }
  }

  const allSucceeded = errors.length === 0;
  let message = '';
  if (allSucceeded) {
    message = `Se aplicaron ${applied.length} comandos correctamente.`;
  } else if (applied.length > 0) {
    message = `Se aplicaron ${applied.length} de ${commands.length} comandos. Hubo ${errors.length} error(es): ${errors.join(' | ')}`;
  } else {
    message = `No se pudo aplicar ningún comando: ${errors.join(' | ')}`;
  }

  return {
    success: applied.length > 0 || (commands.length === 0),
    message,
    model: newModel,
    warnings,
    errors,
    appliedCommands: applied
  };
}

function findClass(model: UMLModel, name: string): UMLClass | undefined {
  const normalizedTarget = name.toLowerCase();
  const direct = model.classes.find(c => c.name.toLowerCase() === normalizedTarget);
  if (direct) return direct;
  // Fuzzy match para pequeñas variaciones fonéticas, plurales o concordancia de género (ej. "usuaria" o "usuarios" -> "Usuario")
  return model.classes.find(c => {
    const cName = c.name.toLowerCase();
    const lenDiff = Math.abs(cName.length - normalizedTarget.length);
    if (lenDiff <= 2 && normalizedTarget.length >= 4 && cName.length >= 4) {
      return cName.slice(0, -2) === normalizedTarget.slice(0, -2);
    }
    return false;
  });
}

function applyCommand(model: UMLModel, cmd: UMLCommand, warnings: string[]): void {
  switch (cmd.type) {
    case 'CREATE_CLASS': {
      if (findClass(model, cmd.className)) {
        warnings.push(`La clase ${cmd.className} ya existe. Se ignora creación.`);
        return;
      }
      model.classes.push({
        id: generateId(),
        name: cmd.className,
        attributes: [],
        operations: []
      });
      break;
    }

    case 'RENAME_CLASS': {
      const cls = findClass(model, cmd.oldClassName);
      if (!cls) throw new Error(`Clase ${cmd.oldClassName} no encontrada.`);
      if (findClass(model, cmd.newClassName)) throw new Error(`La clase destino ${cmd.newClassName} ya existe.`);
      cls.name = cmd.newClassName;
      break;
    }

    case 'DELETE_CLASS': {
      const cls = findClass(model, cmd.className);
      if (!cls) {
        warnings.push(`Clase ${cmd.className} no encontrada al intentar borrar.`);
        return;
      }
      const idsToDelete = new Set<string>();
      
      // Cascade delete: encontrar subclases recursivamente
      function collectNested(ownerId: string) {
        idsToDelete.add(ownerId);
        model.classes.forEach(c => {
          if (c.owner_id === ownerId) {
            collectNested(c.id);
          }
        });
      }
      collectNested(cls.id);

      // Eliminar clases
      model.classes = model.classes.filter(c => !idsToDelete.has(c.id));

      // Eliminar relaciones conectadas a cualquiera de las clases borradas
      model.relationships = model.relationships.filter(r => 
        !idsToDelete.has(r.source_id) && !idsToDelete.has(r.target_id)
      );
      break;
    }

    case 'ADD_ATTRIBUTE': {
      const cls = findClass(model, cmd.className);
      if (!cls) throw new Error(`Clase ${cmd.className} no encontrada.`);
      if (cls.attributes.find(a => a.name.toLowerCase() === cmd.attributeName.toLowerCase())) {
        warnings.push(`El atributo ${cmd.attributeName} ya existe en ${cmd.className}.`);
        return;
      }
      cls.attributes.push({
        id: generateId(),
        name: cmd.attributeName,
        type: cmd.attributeType,
        visibility: 'private'
      });
      break;
    }

    case 'REMOVE_ATTRIBUTE': {
      const cls = findClass(model, cmd.className);
      if (!cls) throw new Error(`Clase ${cmd.className} no encontrada.`);
      const prevLength = cls.attributes.length;
      cls.attributes = cls.attributes.filter(a => a.name.toLowerCase() !== cmd.attributeName.toLowerCase());
      if (cls.attributes.length === prevLength) {
        warnings.push(`Atributo ${cmd.attributeName} no encontrado en ${cmd.className}.`);
      }
      break;
    }

    case 'ADD_OPERATION': {
      const cls = findClass(model, cmd.className);
      if (!cls) throw new Error(`Clase ${cmd.className} no encontrada.`);
      if (cls.operations.find(o => o.name.toLowerCase() === cmd.operationName.toLowerCase())) {
        warnings.push(`La operación ${cmd.operationName} ya existe en ${cmd.className}.`);
        return;
      }
      cls.operations.push({
        id: generateId(),
        name: cmd.operationName,
        return_type: cmd.returnType,
        visibility: 'public'
      });
      break;
    }

    case 'REMOVE_OPERATION': {
      const cls = findClass(model, cmd.className);
      if (!cls) throw new Error(`Clase ${cmd.className} no encontrada.`);
      const prevLength = cls.operations.length;
      cls.operations = cls.operations.filter(o => o.name.toLowerCase() !== cmd.operationName.toLowerCase());
      if (cls.operations.length === prevLength) {
        warnings.push(`Operación ${cmd.operationName} no encontrada en ${cmd.className}.`);
      }
      break;
    }

    case 'CREATE_RELATIONSHIP': {
      const src = findClass(model, cmd.sourceClass);
      const tgt = findClass(model, cmd.targetClass);
      if (!src) throw new Error(`Clase origen ${cmd.sourceClass} no encontrada.`);
      if (!tgt) throw new Error(`Clase destino ${cmd.targetClass} no encontrada.`);

      const isMany = (m?: string) => {
        if (!m) return false;
        const cleaned = m.trim().toLowerCase();
        return cleaned === '*' || cleaned === '0..*' || cleaned === '1..*' || cleaned === 'n' || cleaned === 'm' || cleaned === '0..n' || cleaned === '1..n';
      };

      const isM2M = (cmd.relationshipType === 'ASSOCIATION' || !cmd.relationshipType) && 
                    isMany(cmd.sourceMultiplicity) && 
                    isMany(cmd.targetMultiplicity);

      if (isM2M) {
        // Descomposición automática M:N en clase intermedia
        const intermediateName = `${src.name}${tgt.name}`;
        let intermediateCls = findClass(model, intermediateName);

        if (!intermediateCls) {
          intermediateCls = {
            id: generateId(),
            name: intermediateName,
            attributes: [
              {
                id: generateId(),
                name: 'id',
                type: 'Integer',
                visibility: 'public'
              },
              {
                id: generateId(),
                name: `${src.name.charAt(0).toLowerCase() + src.name.slice(1)}Id`,
                type: 'Integer',
                visibility: 'private'
              },
              {
                id: generateId(),
                name: `${tgt.name.charAt(0).toLowerCase() + tgt.name.slice(1)}Id`,
                type: 'Integer',
                visibility: 'private'
              }
            ],
            operations: []
          };
          model.classes.push(intermediateCls);
        }

        // Relación 1: src (1) -> intermediate (*)
        const rel1Exists = model.relationships.some(r => r.source_id === src.id && r.target_id === intermediateCls!.id);
        if (!rel1Exists) {
          model.relationships.push({
            id: generateId(),
            source_id: src.id,
            target_id: intermediateCls.id,
            type: 'ASSOCIATION',
            source_multiplicity: '1',
            target_multiplicity: '*'
          });
        }

        // Relación 2: tgt (1) -> intermediate (*)
        const rel2Exists = model.relationships.some(r => r.source_id === tgt.id && r.target_id === intermediateCls!.id);
        if (!rel2Exists) {
          model.relationships.push({
            id: generateId(),
            source_id: tgt.id,
            target_id: intermediateCls.id,
            type: 'ASSOCIATION',
            source_multiplicity: '1',
            target_multiplicity: '*'
          });
        }

        warnings.push(`Relación Muchos a Muchos descompuesta automáticamente creando la clase intermedia '${intermediateName}'.`);
        break;
      }

      // Verificar si ya existe esta relación exacta
      const exists = model.relationships.some(r => 
        r.source_id === src.id && r.target_id === tgt.id && r.type === cmd.relationshipType
      );
      
      if (exists) {
        warnings.push(`La relación entre ${cmd.sourceClass} y ${cmd.targetClass} ya existe.`);
        return;
      }

      model.relationships.push({
        id: generateId(),
        source_id: src.id,
        target_id: tgt.id,
        type: cmd.relationshipType,
        source_multiplicity: cmd.sourceMultiplicity || '1',
        target_multiplicity: cmd.targetMultiplicity || '1'
      });
      break;
    }

    case 'CREATE_NESTED_CLASS': {
      const owner = findClass(model, cmd.ownerClass);
      if (!owner) throw new Error(`Clase dueña ${cmd.ownerClass} no encontrada.`);
      
      let nested = findClass(model, cmd.nestedClass);
      if (!nested) {
        // Crear si no existe
        nested = {
          id: generateId(),
          name: cmd.nestedClass,
          attributes: [],
          operations: [],
          owner_id: owner.id
        };
        model.classes.push(nested);
      } else {
        // Si existe, asegurarse de que no genera ciclos
        let curr: UMLClass | undefined = owner;
        while (curr && curr.owner_id) {
          if (curr.owner_id === nested.id) {
            throw new Error(`Anidamiento cíclico: ${cmd.ownerClass} ya está dentro de ${cmd.nestedClass}`);
          }
          curr = model.classes.find(c => c.id === curr!.owner_id);
        }
        nested.owner_id = owner.id;
      }
      break;
    }
  }
}
