import type {
  UMLAttribute,
  UMLModel,
  UMLOperation,
  UMLRelationship,
} from '../../types/canonical-model';

/**
 * Huellas esperadas: id de elemento -> huella (ver `fingerprint.ts`).
 * El valor ABSENT indica que el elemento NO debe existir todavía.
 * Sirve para detectar que otra persona tocó esos elementos desde que se propuso el comando.
 */
export type ExpectedFingerprints = Record<string, string>;

interface BaseCommand {
  /** Identificador único del comando: aplicarlo dos veces no tiene efecto la segunda vez. */
  commandId: string;
  expected?: ExpectedFingerprints;
}

export interface AddClassCommand extends BaseCommand {
  type: 'addClass';
  id: string;
  name: string;
  attributes?: UMLAttribute[];
  operations?: UMLOperation[];
  /** Posición en la lista de clases; por defecto, al final. */
  index?: number;
}
export interface RenameClassCommand extends BaseCommand {
  type: 'renameClass';
  id: string;
  name: string;
}
export interface DeleteClassCommand extends BaseCommand {
  type: 'deleteClass';
  id: string;
}
export interface AddAttributeCommand extends BaseCommand {
  type: 'addAttribute';
  classId: string;
  attribute: UMLAttribute;
  /** Posición dentro de la clase; por defecto, al final. */
  index?: number;
}
export interface UpdateAttributeCommand extends BaseCommand {
  type: 'updateAttribute';
  classId: string;
  attributeId: string;
  changes: Partial<Omit<UMLAttribute, 'id'>>;
}
export interface DeleteAttributeCommand extends BaseCommand {
  type: 'deleteAttribute';
  classId: string;
  attributeId: string;
}
export interface AddRelationshipCommand extends BaseCommand {
  type: 'addRelationship';
  relationship: UMLRelationship;
  /** Posición en la lista de relaciones; por defecto, al final. */
  index?: number;
}
export interface UpdateRelationshipCommand extends BaseCommand {
  type: 'updateRelationship';
  id: string;
  changes: Partial<Omit<UMLRelationship, 'id'>>;
}
export interface DeleteRelationshipCommand extends BaseCommand {
  type: 'deleteRelationship';
  id: string;
}

export type UMLCommand =
  | AddClassCommand
  | RenameClassCommand
  | DeleteClassCommand
  | AddAttributeCommand
  | UpdateAttributeCommand
  | DeleteAttributeCommand
  | AddRelationshipCommand
  | UpdateRelationshipCommand
  | DeleteRelationshipCommand;

export type CommandErrorCode =
  | 'INVALID' // datos mal formados o valores no permitidos
  | 'NOT_FOUND' // el elemento referenciado no existe
  | 'ALREADY_EXISTS' // id repetido
  | 'DUPLICATE_NAME' // nombre repetido dentro de su ámbito
  | 'CONFLICT'; // alguien cambió los elementos afectados desde la propuesta

export interface CommandError {
  ok: false;
  code: CommandErrorCode;
  message: string;
  /** Comando que falló (útil en lotes). */
  commandId?: string;
}

export interface CommandSuccess {
  ok: true;
  model: UMLModel;
  /** Comandos que deshacen exactamente este cambio, en el orden en que deben aplicarse. */
  inverse: UMLCommand[];
  /** Ids de elementos (clases/relaciones) afectados. */
  touched: string[];
  /** true si el commandId ya estaba aplicado y no se hizo nada. */
  duplicate: boolean;
}

export type CommandResult = CommandSuccess | CommandError;

export interface CommandContext {
  /** commandIds ya aplicados (idempotencia). */
  applied?: ReadonlySet<string>;
}
