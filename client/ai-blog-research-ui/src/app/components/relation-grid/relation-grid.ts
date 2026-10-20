import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Observable } from 'rxjs';
import { describeApiError } from '../../models/api-error';
import { EntityDataModel, EntityFieldSchema, EntityRelationModel } from '../../models/entity-form.model';
import { EntityApiService, LookupOption } from '../../services/entity-api.service';
import { EntityGrid } from '../entity-grid/entity-grid';

/**
 * One child collection of an entity (a user role assignments): the reusable grid, plus, when the server says the caller may
 * change it (canCreate, rowPermissions.canDelete), an Add row with a select for each pointer field and a Remove button on each
 * row. The choices come from the lookup links the server supplied, the add and remove URLs from the grid links; nothing about
 * what a child is lives here. Each change goes to the child own endpoint; afterwards the host reloads the parent.
 */
@Component({
  selector: 'app-relation-grid',
  imports: [MatButtonModule, EntityGrid],
  templateUrl: './relation-grid.html',
  styleUrl: './relation-grid.scss',
})
export class RelationGrid implements OnChanges {
  private readonly api = inject(EntityApiService);

  @Input({ required: true }) relation!: EntityRelationModel;

  /** The server accepted a change (an add or a remove): the host should reload the parent. */
  @Output() changed = new EventEmitter<void>();

  protected readonly options = signal<Record<string, LookupOption[]>>({});
  protected readonly choice = signal<Record<string, string>>({});
  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['relation']) {
      this.choice.set({});
      this.loadOptions();
    }
  }

  protected get canAdd(): boolean {
    return !!this.relation.grid.links?.create && this.relation.grid.canCreate === true;
  }

  protected get canRemove(): boolean {
    return this.relation.grid.rowPermissions?.canDelete === true;
  }

  /** The pointer fields of the child, in the server order: one select each. */
  protected get pointerFields(): EntityFieldSchema[] {
    return [...this.relation.grid.schema.fields]
      .filter((field) => !!field.refSchema)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  protected labelOf(field: EntityFieldSchema): string {
    return field.label?.trim() ? field.label : field.name;
  }

  protected removeLink(entityId: string): string | null {
    return this.relation.grid.links?.rows?.[entityId] ?? null;
  }

  protected pick(field: string, value: string): void {
    this.choice.update((current) => ({ ...current, [field]: value }));
  }

  protected get canSubmit(): boolean {
    return this.pointerFields.every((field) => !!this.choice()[field.name]) && !this.busy();
  }

  protected add(): void {
    const link = this.relation.grid.links?.create;
    if (!link || !this.canSubmit) {
      return;
    }

    const values: Record<string, string | null> = {};
    for (const field of this.pointerFields) {
      values[field.name] = this.choice()[field.name];
    }

    this.run(this.api.addChild(link, { entityId: '', values } satisfies EntityDataModel), 'Could not add this.');
  }

  protected remove(entityId: string): void {
    const link = this.removeLink(entityId);
    if (!link || this.busy() || !window.confirm('Remove this entry?')) {
      return;
    }

    this.run(this.api.removeChild(link), 'Could not remove this.');
  }

  private run(call: Observable<unknown>, fallback: string): void {
    this.busy.set(true);
    this.errors.set([]);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.choice.set({});
        this.changed.emit();
      },
      error: (error) => {
        this.busy.set(false);
        this.errors.set(describeApiError(error, fallback));
      },
    });
  }

  private loadOptions(): void {
    this.options.set({});
    if (!this.canAdd) {
      return;
    }

    for (const field of this.pointerFields) {
      const link = this.relation.grid.links?.lookups?.[field.name];
      if (link) {
        this.api.lookup(link).subscribe({
          next: (found) => this.options.update((current) => ({ ...current, [field.name]: found })),
          error: (error) => this.errors.update((messages) => [...messages, ...describeApiError(error, 'Could not load the choices.')]),
        });
      }
    }
  }
}
