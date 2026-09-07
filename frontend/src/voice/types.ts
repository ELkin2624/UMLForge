export type UMLCommandType = 
  | 'CREATE_CLASS'
  | 'RENAME_CLASS'
  | 'DELETE_CLASS'
  | 'ADD_ATTRIBUTE'
  | 'REMOVE_ATTRIBUTE'
  | 'ADD_OPERATION'
  | 'REMOVE_OPERATION'
  | 'CREATE_RELATIONSHIP' // Unifica asociación, composición, agregación, dependencia, generalización
  | 'CREATE_NESTED_CLASS';

export interface CreateClassCommand {
  type: 'CREATE_CLASS';
  className: string;
}

export interface RenameClassCommand {
  type: 'RENAME_CLASS';
  oldClassName: string;
  newClassName: string;
}

export interface DeleteClassCommand {
  type: 'DELETE_CLASS';
  className: string;
}

export interface AddAttributeCommand {
  type: 'ADD_ATTRIBUTE';
  className: string;
  attributeName: string;
  attributeType: string;
}

export interface RemoveAttributeCommand {
  type: 'REMOVE_ATTRIBUTE';
  className: string;
  attributeName: string;
}

export interface AddOperationCommand {
  type: 'ADD_OPERATION';
  className: string;
  operationName: string;
  returnType: string;
}

export interface RemoveOperationCommand {
  type: 'REMOVE_OPERATION';
  className: string;
  operationName: string;
}

export interface CreateRelationshipCommand {
  type: 'CREATE_RELATIONSHIP';
  sourceClass: string;
  targetClass: string;
  relationshipType: 'ASSOCIATION' | 'AGGREGATION' | 'COMPOSITION' | 'GENERALIZATION' | 'DEPENDENCY' | 'REALIZATION';
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
}

export interface CreateNestedClassCommand {
  type: 'CREATE_NESTED_CLASS';
  ownerClass: string;
  nestedClass: string;
}

export type UMLCommand = 
  | CreateClassCommand
  | RenameClassCommand
  | DeleteClassCommand
  | AddAttributeCommand
  | RemoveAttributeCommand
  | AddOperationCommand
  | RemoveOperationCommand
  | CreateRelationshipCommand
  | CreateNestedClassCommand;

export interface CommandResult {
  success: boolean;
  model?: any; // Será de tipo UMLModel del CanonicalModel
  message: string;
  warnings: string[];
  errors: string[];
  appliedCommands?: UMLCommand[];
}
