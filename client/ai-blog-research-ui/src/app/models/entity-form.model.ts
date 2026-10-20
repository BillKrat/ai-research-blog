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
  /** The schema a pointer field points at (a lookup is offered from it); null for an ordinary field. */
  refSchema?: string | null;
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
  /** The text to show for a pointer field (its value is another entity id); absent when there is none. */
  display?: Record<string, string> | null;
}

/**
 * Mirrors Adventures.Entities.EntityGridModel: the columns (a schema) and one data model per row. The grid-contract stage
 * adds paging, sorting and per-row permissions; this is its first, minimal form.
 */
/** Where a grid page sits in the whole list (the server counts; the client only draws the pager). */
export interface GridPaging {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  sort: string | null;
  descending: boolean;
}

/** Server-supplied URLs (relative to the API root); the client follows them and holds no URL templates. */
export interface EntityGridLinks {
  self: string | null;
  create?: string | null;
  next?: string | null;
  previous?: string | null;
  /** The form URL of each row, by entity id. */
  rows?: Record<string, string> | null;
  /** The lookup URL of each pointer field, by field name (the choices for a select). */
  lookups?: Record<string, string> | null;
}

export interface EntityGridModel {
  schema: EntitySchemaModel;
  rows: EntityDataModel[];
  paging?: GridPaging | null;
  canCreate?: boolean;
  rowPermissions?: EntityPermissions | null;
  links?: EntityGridLinks | null;
  contractVersion?: number;
}

export interface EntityFormModel {
  schema: EntitySchemaModel;
  entity: EntityDataModel;
  permissions?: EntityPermissions | null;
  contractVersion?: number;
  /** The child collections the schema declares, each a grid (read from the server, never assembled here). */
  relations?: EntityRelationModel[] | null;
  /** The lookup URL of each pointer field, by field name (the choices for a select). */
  lookups?: Record<string, string> | null;
}

export interface EntityRelationModel {
  name: string;
  label: string;
  grid: EntityGridModel;
}
