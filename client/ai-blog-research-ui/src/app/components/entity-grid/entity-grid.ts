import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, TemplateRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '../../i18n/labels';
import { EntityFieldSchema, EntityGridModel } from '../../models/entity-form.model';

/** What the user asked of the grid; the host turns it into a request (the grid never fetches anything). */
export type GridRequest =
  | { kind: 'next' }
  | { kind: 'previous' }
  | { kind: 'sort'; field: string; descending: boolean }
  | { kind: 'open'; entityId: string; link: string }
  | { kind: 'toggle'; entityId: string; link: string; field: string; value: boolean };

/**
 * Renders any EntityGridModel: one column per list-visible schema field (the server flags the defaults; the gear lets the
 * user show or hide any field, and remembers it only for this page view), one row per entity, and a details panel under a
 * clicked row that shows every field in full (a stack trace does not fit a cell). When the model carries paging, the
 * headers sort and a pager moves between pages; both only emit a <see cref="GridRequest"/> for the host to carry out.
 * Knows nothing about what a row is, so each new grid (users, roles, posts) needs no new component.
 */
@Component({
  selector: 'app-entity-grid',
  imports: [NgTemplateOutlet, MatSlideToggleModule, MatButtonModule, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './entity-grid.html',
  styleUrl: './entity-grid.scss',
})
export class EntityGrid implements OnChanges {
  @Input({ required: true }) model!: EntityGridModel;

  /** Optional extra content under a row's details (an action button, a result panel); gets the row as its context. */
  @Input() rowTools?: TemplateRef<{ $implicit: EntityGridModel['rows'][number] }>;

  /** Boolean fields (by name) the host lets the user flip right in the list; each flip is emitted as a 'toggle' request. */
  @Input() toggleFields: string[] = [];

  /** A field that, when a row has a value in it, locks that row's switches (a post's RevisionOf: a revision is applied or discarded, never published). */
  @Input() toggleLockedField: string | null = null;

  /** The user asked for another page or another sort order. */
  @Output() request = new EventEmitter<GridRequest>();

  protected expandedId: string | null = null;
  protected gearOpen = false;

  /** Columns the user switched on or off with the gear, by field name; absent means "the server's default". */
  private readonly overrides = new Map<string, boolean>();

  /** Fields that are long text rather than a value: shown in the details panel, summarised in one trailing column. */
  private static readonly LongTextFields = new Set(['StackTrace', 'Message']);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model'] && changes['model'].previousValue?.schema?.schemaIri !== this.model.schema.schemaIri) {
      this.overrides.clear();
    }
  }

  /** The fields in the server's order. */
  protected get fields(): EntityFieldSchema[] {
    return [...this.model.schema.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  protected isVisible(field: EntityFieldSchema): boolean {
    return this.overrides.get(field.name) ?? field.isListVisible !== false;
  }

  /** Columns shown in the row itself (long text goes to the trailing column and the details). */
  protected get columns(): EntityFieldSchema[] {
    return this.fields.filter((field) => this.isVisible(field) && !EntityGrid.LongTextFields.has(field.name));
  }

  protected get hasMessage(): boolean {
    const message = this.model.schema.fields.find((field) => field.name === 'Message');
    return message !== undefined && this.isVisible(message);
  }

  protected labelOf(field: EntityFieldSchema): string {
    return field.label?.trim() ? field.label : field.name;
  }

  protected toggleColumn(field: EntityFieldSchema): void {
    this.overrides.set(field.name, !this.isVisible(field));
  }

  protected toggle(entityId: string): void {
    this.expandedId = this.expandedId === entityId ? null : entityId;
  }

  protected cell(row: EntityGridModel['rows'][number], column: string): string {
    return row.display?.[column] ?? row.values[column] ?? '';
  }

  // --- sorting and paging (only when the server sent paging) ---

  protected get sortable(): boolean {
    return !!this.model.paging;
  }

  protected ariaSort(field: EntityFieldSchema): 'ascending' | 'descending' | 'none' {
    const paging = this.model.paging;
    if (!paging || paging.sort?.toLowerCase() !== field.name.toLowerCase()) {
      return 'none';
    }
    return paging.descending ? 'descending' : 'ascending';
  }

  protected sortBy(field: EntityFieldSchema): void {
    if (!this.sortable) {
      return;
    }
    const current = this.ariaSort(field);
    this.request.emit({ kind: 'sort', field: field.name, descending: current === 'ascending' });
  }

/** The server-supplied form link of a row, when it gave one. */  protected rowLink(row: EntityGridModel['rows'][number]): string | null {    return this.model.links?.rows?.[row.entityId] ?? null;  }  protected open(row: EntityGridModel['rows'][number]): void {    const link = this.rowLink(row);    if (link) {      this.request.emit({ kind: 'open', entityId: row.entityId, link });    }  }
  protected isToggle(field: EntityFieldSchema): boolean {
    return this.toggleFields.includes(field.name);
  }

  protected isLocked(row: EntityGridModel['rows'][number]): boolean {
    return !!this.toggleLockedField && !!row.values[this.toggleLockedField];
  }

  protected flip(row: EntityGridModel['rows'][number], field: EntityFieldSchema, value: boolean): void {
    const link = this.rowLink(row);
    if (link) {
      this.request.emit({ kind: 'toggle', entityId: row.entityId, link, field: field.name, value });
    }
  }

  protected next(): void {
    this.request.emit({ kind: 'next' });
  }

  protected previous(): void {
    this.request.emit({ kind: 'previous' });
  }
}
