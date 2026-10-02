/**
 * Mirrors Adventures.Entities.EntityFormModel (Adventures.Foundation) - the "standard object" a
 * schema-driven form renders from: a Schema part (field name/type/required, no values) and an
 * Entity part (the current values), kept separate rather than merged into one per-field list.
 * Generic for any entity type, not profile-specific - EntityForm (components/entity-form) is the
 * reusable renderer built against this shape.
 */
export interface EntityFieldSchema {
  name: string;
  type: string;
  isRequired: boolean;
}

export interface EntitySchemaModel {
  schemaIri: string;
  fields: EntityFieldSchema[];
}

export interface EntityDataModel {
  entityId: string;
  values: Record<string, string | null>;
}

export interface EntityFormModel {
  schema: EntitySchemaModel;
  entity: EntityDataModel;
}
