// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MarkdownContent } from '../markdown-content/markdown-content';
import { EntityFieldSchema, EntityFormModel, SUPPORTED_CONTRACT_VERSION } from '../../models/entity-form.model';
import { LabelPipe } from '../../i18n/labels';
import { describeApiError } from '../../models/api-error';
import { EntityApiService, LookupOption } from '../../services/entity-api.service';
import { MediaService } from '../../services/media.service';

/** How a field is drawn; decided from the server-supplied type name, never from the entity. */
export type ControlKind = 'text' | 'date' | 'number' | 'checkbox' | 'ref' | 'refs' | 'markdown' | 'html' | 'choice';

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
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatButtonModule, MatIconModule, MatTooltipModule, LabelPipe, MarkdownContent],
  templateUrl: './entity-form.html',
  styleUrl: './entity-form.scss',
})
export class EntityForm implements OnChanges {
  private readonly api = inject(EntityApiService);
  private readonly media = inject(MediaService);
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) model!: EntityFormModel;

  @Output() save = new EventEmitter<Record<string, string | null>>();

  readonly form = new UntypedFormGroup({});

  /** Choices of the pointer fields, by field name, as the server lookups answered. */
  protected readonly options = signal<Record<string, LookupOption[]>>({});

  /** Which Markdown or HTML fields show their preview instead of the editor. */
  protected readonly previewing = signal<Record<string, boolean>>({});

  /** Which Markdown fields are uploading an image now, and what the server said when it refused one. */
  protected readonly uploading = signal<Record<string, boolean>>({});
  protected readonly uploadErrors = signal<Record<string, string[]>>({});

  /**
   * Uploads the chosen image and inserts the Markdown that shows it where the cursor is in that field (at the end when the field is not
   * being edited). The server decides what is an image; a refusal is shown above the field in its own words.
   */
  protected insertImage(field: EntityFieldSchema, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.uploading.update((current) => ({ ...current, [field.name]: true }));
    this.uploadErrors.update((current) => ({ ...current, [field.name]: [] }));
    this.media.upload(file).subscribe({
      next: (item) => {
        this.insertAtCursor(field.name, `${item.markdown}\n`);
        this.uploading.update((current) => ({ ...current, [field.name]: false }));
      },
      error: (error) => {
        this.uploadErrors.update((current) => ({ ...current, [field.name]: describeApiError(error, 'Could not upload that image.') }));
        this.uploading.update((current) => ({ ...current, [field.name]: false }));
      },
    });
  }

  private insertAtCursor(name: string, text: string): void {
    const control = this.form.controls[name];
    const current = String(control?.value ?? '');
    const area = (this.host.nativeElement as HTMLElement).querySelector(`textarea[data-field="${name}"]`) as HTMLTextAreaElement | null;
    const start = area ? area.selectionStart : current.length;
    const end = area ? area.selectionEnd : current.length;
    const before = current.slice(0, start);
    const lead = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    control.setValue(`${before}${lead}${text}${current.slice(end)}`);
    control.markAsDirty();
  }

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
    if (field.choices && field.choices.length > 0) {
      return 'choice';
    }

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

  /** A choice the server lists but does not allow now (its plug-in is switched off). */
  protected isDisabledChoice(field: EntityFieldSchema, choice: string): boolean {
    return field.disabledChoices?.includes(choice) === true;
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

    this.rememberValues(values);
    this.save.emit(values);
  }

  private rebuildForm(): void {
    for (const key of Object.keys(this.form.controls)) {
      this.form.removeControl(key);
    }

    for (const field of this.model.schema.fields) {
      const stored = this.model.entity.values[field.name] ?? '';
      const raw = stored === '' ? this.startingValue(field) : stored;
      const value = this.kindOf(field) === 'checkbox' ? raw.toLowerCase() === 'true' : raw;
      this.form.addControl(field.name, new UntypedFormControl({ value, disabled: field.isReadOnly === true }));
    }
  }

  /**
   * A new entity (no id yet) starts a "remember" field, and a choice field, from what was last saved here (this browser only), else
   * from the first choice; an existing entity shows what it holds. Storage can be blocked or empty: then the form just starts blank.
   */
  private startingValue(field: EntityFieldSchema): string {
    if (this.model.entity.entityId) {
      return '';
    }

    let last = '';
    if (field.remember) {
      try {
        last = localStorage.getItem(this.rememberKey(field)) ?? '';
      } catch {
        last = '';
      }
    }

    const usable = (field.choices ?? []).filter((choice) => !this.isDisabledChoice(field, choice));
    return last && !this.isDisabledChoice(field, last) ? last : (usable[0] ?? '');
  }

  private rememberValues(values: Record<string, string | null>): void {
    if (this.model.entity.entityId) {
      return;
    }

    for (const field of this.model.schema.fields.filter((f) => f.remember)) {
      const value = values[field.name];
      if (value) {
        try {
          localStorage.setItem(this.rememberKey(field), value);
        } catch {
          // a blocked store only means no default next time
        }
      }
    }
  }

  private rememberKey(field: EntityFieldSchema): string {
    return `entity.last.${this.model.schema.schemaIri}.${field.name}`;
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
