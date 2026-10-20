import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EntityFieldSchema, EntityFormModel, SUPPORTED_CONTRACT_VERSION } from '../../models/entity-form.model';

/** How a field is drawn; decided from the server-supplied type name, never from the entity. */
export type ControlKind = 'text' | 'date' | 'number' | 'checkbox';

/**
 * Renders one control per schema field, from the matching entity value - the same technique
 * poc/nquad-end-to-end-poc's app-screen.html demonstrates, now driven by the real EntitySchema.
 * Generic: works for any EntityFormModel - a page hosts it and projects its own Save/Delete/etc. actions via
 * content projection. Everything about a field comes from the server: its label, its place (order), whether it is
 * read-only, and its type, which picks the control (a date picker for dates, a checkbox for booleans, a number input
 * for numbers, text otherwise). A model of a newer contract version than this client knows is refused, not guessed at.
 * isRequired is a visual hint (the required marker); the server validates.
 */
@Component({
  selector: 'app-entity-form',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatCheckboxModule],
  templateUrl: './entity-form.html',
  styleUrl: './entity-form.scss',
})
export class EntityForm implements OnChanges {
  @Input({ required: true }) model!: EntityFormModel;

  @Output() save = new EventEmitter<Record<string, string | null>>();

  readonly form = new UntypedFormGroup({});

  /** True when the server speaks a newer contract than this client understands. */
  get unsupported(): boolean {
    return (this.model?.contractVersion ?? SUPPORTED_CONTRACT_VERSION) > SUPPORTED_CONTRACT_VERSION;
  }

  /** The fields in the server's order (sorted here too, so a server that forgets to still renders sensibly). */
  get fields(): EntityFieldSchema[] {
    return [...this.model.schema.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this.rebuildForm();
    }
  }

  kindOf(field: EntityFieldSchema): ControlKind {
    switch (field.type.toLowerCase()) {
      case 'date':
        return 'date';
      case 'bool':
      case 'boolean':
        return 'checkbox';
      case 'int':
      case 'integer':
      case 'long':
      case 'double':
      case 'decimal':
        return 'number';
      default:
        return 'text';
    }
  }

  labelOf(field: EntityFieldSchema): string {
    return field.label?.trim() ? field.label : field.name;
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue() as Record<string, unknown>;
    const values: Record<string, string | null> = {};
    for (const field of this.model.schema.fields) {
      const value = raw[field.name];
      values[field.name] = this.kindOf(field) === 'checkbox' ? (value ? 'true' : 'false') : ((value as string | null) ?? '');
    }

    this.save.emit(values);
  }

  private rebuildForm(): void {
    for (const key of Object.keys(this.form.controls)) {
      this.form.removeControl(key);
    }

    for (const field of this.model.schema.fields) {
      const raw = this.model.entity.values[field.name] ?? '';
      const value = this.kindOf(field) === 'checkbox' ? raw.toLowerCase() === 'true' : raw;
      this.form.addControl(field.name, new UntypedFormControl({ value, disabled: field.isReadOnly === true }));
    }
  }
}
