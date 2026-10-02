import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EntityFormModel } from '../../models/entity-form.model';

/**
 * Renders one control per schema field, from the matching entity value - the same technique
 * poc/nquad-end-to-end-poc's app-screen.html demonstrates, now driven by the real EntitySchema
 * instead of a hand-written field list. Generic: works for any EntityFormModel, not just a user
 * profile - a page hosts it and projects its own Save/Delete/etc. actions via content projection,
 * so the form shell stays reusable across different screens.
 *
 * No validation yet (declared scope for this stage): every field renders as a plain text input,
 * and isRequired is only a visual hint (mat-form-field's required marker), not a blocking
 * Validator. A later data-driven rule (e.g. "this field is read-only") is expected to extend
 * EntityFieldSchema and this component to act on it - neither exists yet.
 */
@Component({
  selector: 'app-entity-form',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './entity-form.html',
  styleUrl: './entity-form.scss',
})
export class EntityForm implements OnChanges {
  @Input({ required: true }) model!: EntityFormModel;

  @Output() save = new EventEmitter<Record<string, string | null>>();

  readonly form = new UntypedFormGroup({});

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this.rebuildForm();
    }
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    this.save.emit(this.form.getRawValue());
  }

  private rebuildForm(): void {
    for (const key of Object.keys(this.form.controls)) {
      this.form.removeControl(key);
    }

    for (const field of this.model.schema.fields) {
      const value = this.model.entity.values[field.name] ?? '';
      this.form.addControl(field.name, new UntypedFormControl(value));
    }
  }
}
