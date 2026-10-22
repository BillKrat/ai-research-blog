import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MarkdownContent } from '../markdown-content/markdown-content';
import { EntityFieldSchema, EntityFormModel, SUPPORTED_CONTRACT_VERSION } from '../../models/entity-form.model';
import { EntityApiService, LookupOption } from '../../services/entity-api.service';

/** How a field is drawn; decided from the server-supplied type name, never from the entity. */
export type ControlKind = 'text' | 'date' | 'number' | 'checkbox' | 'ref' | 'refs' | 'markdown' | 'html';

/**
 * Renders one control per schema field, from the matching entity value. Generic: works for any EntityFormModel - a page hosts
 * it and projects its own Save/Delete/etc. actions via content projection. Everything about a field comes from the server: its
 * label, its place (order), whether it is read-only, and its type, which picks the control (a date picker for dates, a checkbox
 * for booleans, a number input for numbers, a select filled from the server lookup link for a pointer to another entity, a
 * text area with a preview for Markdown and HTML, text otherwise). A model of a newer contract version than this client knows is
 * refused, not guessed at. isRequired is a visual hint (the required marker); the server validates.
 */
@Component({
  selector: 'app-entity-form',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MarkdownContent],
  templateUrl: './entity-form.html',
  styleUrl: './entity-form.scss',
})
export class EntityForm implements OnChanges {
  private readonly api = inject(EntityApiService);

  @Input({ required: true }) model!: EntityFormModel;

  @Output() save = new EventEmitter<Record<string, string | null>>();

  readonly form = new UntypedFormGroup({});

  /** Choices of the pointer fields, by field name, as the server lookups answered. */
  protected readonly options = signal<Record<string, LookupOption[]>>({});

  /** Which Markdown or HTML fields show their preview instead of the editor. */
  protected readonly previewing = signal<Record<string, boolean>>({});

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
      this.loadOptions();
    }
  }

  kindOf(field: EntityFieldSchema): ControlKind {
    if (field.refSchema) {
      return field.type.toLowerCase().startsWith('refs:') ? 'refs' : 'ref';
    }

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
      case 'markdown':
        return 'markdown';
      case 'html':
        return 'html';
      default:
        return 'text';
    }
  }

  labelOf(field: EntityFieldSchema): string {
    return field.label?.trim() ? field.label : field.name;
  }

  /** A multi-valued pointer field holds a comma-separated list of ids; the checkboxes add and remove ids from it. */
  protected chosen(name: string): string[] {
    return String(this.form.controls[name]?.value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  protected isChosen(name: string, id: string): boolean {
    return this.chosen(name).includes(id);
  }

  protected toggleChoice(name: string, id: string): void {
    const ids = this.chosen(name);
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    this.form.controls[name].setValue(next.join(','));
    this.form.controls[name].markAsDirty();
  }

  protected togglePreview(name: string): void {
    this.previewing.update((current) => ({ ...current, [name]: !current[name] }));
  }

  /** The text of a field as typed, for the preview. */
  protected textOf(field: EntityFieldSchema): string {
    return String(this.form.controls[field.name]?.value ?? '');
  }

  /** The preview of an HTML field; Angular sanitises it when it is bound as HTML. (Markdown is previewed by app-markdown-content.) */
  protected previewOf(field: EntityFieldSchema): string {
    return this.textOf(field);
  }

  /** Sets a boolean field from outside (a toolbar button such as Publish) and marks the form changed; the caller then submits. */
  setFlag(name: string, value: boolean): void {
    const control = this.form.controls[name];
    if (control) {
      control.setValue(value);
      control.markAsDirty();
    }
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

  /** Fills each pointer field select from the lookup link the server put in the model. */
  private loadOptions(): void {
    this.options.set({});
    for (const field of this.model.schema.fields.filter((f) => !!f.refSchema)) {
      const link = this.model.lookups?.[field.name];
      if (link) {
        this.api.lookup(link).subscribe({
          next: (found) => this.options.update((current) => ({ ...current, [field.name]: found })),
        });
      }
    }
  }
}
