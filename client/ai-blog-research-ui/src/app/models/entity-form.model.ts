/**
 * Mirrors Adventures.Entities.EntityFormModel (Adventures.Foundation) - the "standard object" a
 * schema-driven form renders from: a Schema part (field name/type/required, no values) and an
 * Entity part (the current values), kept separate rather than merged into one per-field list.
 * Generic for any entity type, not profile-specific - EntityForm (components/entity-form) is the
 * reusable renderer built against this shape.
 */
/** The highest contract version this client understands (Adventures.Entities.EntityContract.Version). */
export const SUPPORTED_CONTRACT_VERSION = 1;

/**
 * One field of a schema, computed by the server: the label to show, whether it may be changed (the server also refuses a
 * change), its place among the others and whether a grid shows it by default. Older servers omit the optional ones.
 */
export interface EntityFieldSchema {
  name: string;
  type: string;
  isRequired: boolean;
  label?: string | null;
  isReadOnly?: boolean;
  order?: number;
  isListVisible?: boolean;
}

/** What the caller may do with one entity; the server enforces it, the renderer only decides which buttons to show. */
export interface EntityPermissions {
  canUpdate: boolean;
  canDelete: boolean;
}

export interface EntitySchemaModel {
  schemaIri: string;
  fields: EntityFieldSchema[];
}

export interface EntityDataModel {
  entityId: string;
  values: Record<string, string | null>;
}

/**
 * Mirrors Adventures.Entities.EntityGridModel: the columns (a schema) and one data model per row. The grid-contract stage
 * adds paging, sorting and per-row permissions; this is its first, minimal form.
 */
export interface EntityGridModel {
  schema: EntitySchemaModel;
  rows: EntityDataModel[];
}

export interface EntityFormModel {
  schema: EntitySchemaModel;
  entity: EntityDataModel;
  permissions?: EntityPermissions | null;
  contractVersion?: number;
}
