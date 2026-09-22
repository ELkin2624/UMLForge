export interface MobileFieldConfig {
  name: string;
  label: string;
  ui_type: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'email' | 'phone' | 'currency';
  required: boolean;
  is_primary_key: boolean;
  is_list_visible: boolean;
  is_searchable: boolean;
  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
}

export interface MobileRelationConfig {
  name: string;
  target_entity: string;
  relation_kind: string;
  join_column?: string;
  is_collection: boolean;
}

export interface MobileEntityConfig {
  name: string;
  plural_name: string;
  table_name: string;
  resource_path: string;
  icon: string;
  id_field_name: string;
  fields: MobileFieldConfig[];
  relations: MobileRelationConfig[];
}

export interface MobileSchemaInfo {
  schema_version: string;
  project_name: string;
  domain: string;
  entities: MobileEntityConfig[];
}

export interface ManifestInfo {
  project: string;
  display_name: string;
  version: string;
  domain: string;
  schema_version: string;
  generator_version: string;
  backend: {
    base_url: string;
  };
  ai: {
    enabled: boolean;
    driver: string;
    model: string;
    fallback_driver?: string;
  };
  branding: {
    app_title: string;
    primary_color: string;
    secondary_color: string;
    background_color: string;
    dark_color: string;
  };
}
