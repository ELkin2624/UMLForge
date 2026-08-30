export type UMLVisibility = 'public' | 'private' | 'protected' | 'package';

export interface UMLAttribute {
  id: string;
  name: string;
  type: string;
  visibility?: UMLVisibility;
}

export interface UMLOperation {
  id: string;
  name: string;
  return_type?: string;
  visibility?: UMLVisibility;
  parameters?: UMLAttribute[]; // Usamos UMLAttribute para parámetros por simplicidad
}

export interface UMLClass {
  id: string;
  name: string;
  attributes: UMLAttribute[];
  operations: UMLOperation[];
}

export interface UMLRelationship {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  source_multiplicity?: string;
  target_multiplicity?: string;
}

export interface UMLComponent {
  id: string;
  name: string;
  description?: string;
}

export interface UMLInterface {
  id: string;
  name: string;
  description?: string;
  operations: UMLOperation[];
}

export interface UMLPort {
  id: string;
  name: string;
  component_id: string;
  interface_id: string;
  kind: 'provided' | 'required';
}

export interface UMLConnector {
  id: string;
  name?: string;
  source_port_id: string;
  target_port_id: string;
}

export interface UMLDependency {
  id: string;
  source_id: string;
  target_id: string;
  type?: 'dependency' | 'abstraction' | 'realization';
}

export interface UMLModel {
  id?: string;
  name?: string;
  uml_version?: string;
  classes: UMLClass[];
  relationships: UMLRelationship[];
  components: UMLComponent[];
  interfaces: UMLInterface[];
  ports?: UMLPort[];
  connectors?: UMLConnector[];
  dependencies?: UMLDependency[];
  diagrams: unknown[];
}
