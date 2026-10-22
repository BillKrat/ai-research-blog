import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { EntityForm } from '../../components/entity-form/entity-form';
import { RelationGrid } from '../../components/relation-grid/relation-grid';
import { LabelPipe } from '../../i18n/labels';
import { describeApiError } from '../../models/api-error';
import { EntityAction, EntityFormModel } from '../../models/entity-form.model';
import { EntityApiService } from '../../services/entity-api.service';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * One admin screen for any single entity: its form (typed controls, read-only fields and the Save and Delete buttons decided
 * by the server) and under it one grid per child collection the schema declares. The route id "new" opens the empty form of
 * the collection; saving it creates the entity and moves to its own screen. The form link comes from the grid row the user
 * opened; opened directly (a reload, a bookmark) it falls back to the collection path plus the id.
 */
@Component({
  selector: 'app-admin-entity',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, LabelPipe, EntityForm, RelationGrid],
  templateUrl: './admin-entity.html',
  styleUrl: './admin-entity.scss',
})
export class AdminEntity implements OnInit {
  private readonly api = inject(EntityApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly title = signal('');
  protected readonly model = signal<EntityFormModel | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isNew = signal(false);
  protected readonly loadErrors = signal<string[]>([]);
  protected readonly saveState = signal<SaveState>('idle');
  protected readonly saveErrors = signal<string[]>([]);

  private readonly entityForm = viewChild(EntityForm);

  private link = '';
  private collection = '';
  private listSegment = '';

  ngOnInit(): void {
    this.collection = this.route.snapshot.data['collection'] as string;
    this.title.set(this.route.snapshot.data['title'] as string);
    this.listSegment = this.collection.split('/').pop() ?? '';
    // Angular keeps this component alive when only the id changes (new -> the created entity), so load on every id, not once:
    // otherwise the screen stays on the blank "new" form and a second Save creates a duplicate.
    this.route.paramMap.subscribe((params) => this.load(params.get('id') ?? ''));
  }

  private load(id: string): void {
    this.isLoading.set(true);
    this.model.set(null);
    this.loadErrors.set([]);
    this.saveErrors.set([]);
    this.saveState.set('idle');
    this.isNew.set(id === 'new');
    const handedOver = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as { link?: string } | undefined;
    this.link = this.isNew() ? `${this.collection}/new` : (handedOver?.link ?? `${this.collection}/${encodeURIComponent(id)}`);

    this.api.form(this.link).subscribe({
      next: (form) => {
        this.model.set(form);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.loadErrors.set(describeApiError(error, 'Could not load this entry.'));
      },
    });
  }

  /** A child was added or removed: read the parent again so every grid shows what the server now holds. */
  protected reload(): void {
    this.api.form(this.link).subscribe({
      next: (form) => this.model.set(form),
      error: (error) => {
        // an action such as Apply revision or Discard revision removes this entry: there is nothing left to show, go back to the list
        if ((error as { status?: number })?.status === 404) {
          this.back();
          return;
        }
        this.loadErrors.set(describeApiError(error, 'Could not refresh this entry.'));
      },
    });
  }

  protected back(): void {
    void this.router.navigate(['/admin', this.listSegment]);
  }

  /** The Material icon of a server-offered action; an action this client does not know gets a neutral one. */
  protected iconOf(action: EntityAction): string {
    switch (action.name) {
      case 'publish':
        return 'visibility';
      case 'unpublish':
        return 'visibility_off';
      case 'apply-revision':
        return 'check_circle';
      case 'discard-revision':
        return 'cancel';
      default:
        return 'play_arrow';
    }
  }

  /**
   * Pages (and any entity whose published flag is an ordinary field) have no server publish action, so the editor offers the same
   * eye button itself: it flips the flag in the form and saves. An entity with a server action (posts) keeps that action instead.
   */
  protected get canTogglePublish(): boolean {
    const form = this.model();
    const field = form?.schema.fields.find((f) => f.name === 'IsPublished');
    const hasAction = (form?.actions ?? []).some((a) => a.name === 'publish' || a.name === 'unpublish');
    return !!field && field.isReadOnly !== true && !hasAction && !this.isNew() && form?.permissions?.canUpdate !== false;
  }

  protected get isPublished(): boolean {
    return this.model()?.entity.values['IsPublished']?.toLowerCase() === 'true';
  }

  protected togglePublish(): void {
    const editor = this.entityForm();
    if (!editor) {
      return;
    }

    editor.setFlag('IsPublished', !this.isPublished);
    editor.submit();
  }

  protected get canDelete(): boolean {
    return !this.isNew() && this.model()?.permissions?.canDelete !== false;
  }

  protected onSave(values: Record<string, string | null>): void {
    const current = this.model();
    if (!current || this.saveState() === 'saving') {
      return;
    }

    this.saveState.set('saving');
    this.saveErrors.set([]);
    const call = this.isNew() ? this.api.create(this.collection, values) : this.api.update(this.link, current.entity.entityId, values);
    call.subscribe({
      next: (form) => {
        this.saveState.set('saved');
        if (this.isNew()) {
          // the entity exists now: continue on its own screen (relations, delete) with the server-supplied form
          void this.router.navigate(['/admin', this.listSegment, form.entity.entityId], { replaceUrl: true });
        } else {
          this.model.set(form);
        }
      },
      error: (error) => {
        this.saveErrors.set(describeApiError(error, 'Could not save.'));
        this.saveState.set('error');
      },
    });
  }

  /** Runs an action the server offered (publish, unpublish), after its confirmation, then reads the entity again. */
  protected runAction(action: EntityAction): void {
    if (action.confirm && !window.confirm(action.confirm)) {
      return;
    }

    this.saveErrors.set([]);
    this.api.runAction(action.link).subscribe({
      next: () => this.reload(),
      error: (error) => this.saveErrors.set(describeApiError(error, 'Could not do that.')),
    });
  }

  protected remove(): void {
    if (!this.canDelete || !window.confirm('Delete this entry?')) {
      return;
    }

    this.api.remove(this.link).subscribe({
      next: () => this.back(),
      error: (error) => this.saveErrors.set(describeApiError(error, 'Could not delete.')),
    });
  }
}
