import { Component, Input } from '@angular/core';
import { EntityGridModel } from '../../models/entity-form.model';

/**
 * Renders any EntityGridModel: one column per schema field, one row per entity, and a details panel under a clicked row
 * that shows every field in full (a stack trace does not fit a cell). Knows nothing about what a row is, so the next
 * grid (users, roles, posts) needs no new component. Paging, sorting and the column-visibility gear arrive with the
 * grid-contract stage.
 */
@Component({
  selector: 'app-entity-grid',
  templateUrl: './entity-grid.html',
  styleUrl: './entity-grid.scss',
})
export class EntityGrid {
  @Input({ required: true }) model!: EntityGridModel;

  protected expandedId: string | null = null;

  /** Fields that are long text rather than a value: shown in the details panel, summarised in one trailing column. */
  private static readonly LongTextFields = new Set(['StackTrace', 'Message']);

  /** Columns shown in the row itself; "Id" is only useful in the details. */
  protected get columns(): string[] {
    return this.model.schema.fields
      .map((field) => field.name)
      .filter((name) => name !== 'Id' && !EntityGrid.LongTextFields.has(name));
  }

  protected get hasMessage(): boolean {
    return this.model.schema.fields.some((field) => field.name === 'Message');
  }

  protected toggle(entityId: string): void {
    this.expandedId = this.expandedId === entityId ? null : entityId;
  }

  protected cell(row: EntityGridModel['rows'][number], column: string): string {
    return row.values[column] ?? '';
  }
}
