// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Conversation } from '../../components/conversation/conversation';
import { RightsChecklist } from '../../components/rights-checklist/rights-checklist';
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
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, LabelPipe, RouterLink, EntityForm, RelationGrid, Conversation, RightsChecklist],
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

  /** Posts have a conversation (questions, answers, decisions) under the editor, once saved. */
  protected get hasConversation(): boolean {
    return (this.collection === '/api/posts' || this.collection === '/api/collaboration') && !this.isNew() && !!this.model()?.entity.entityId;
  }

  protected get conversationBase(): 'posts' | 'collaboration' {
    return this.collection === '/api/collaboration' ? 'collaboration' : 'posts';
  }

  /** A saved role shows its rights as a checklist under the form (the roles endpoint is itself behind the roles.manage right). */
  protected get hasRightsChecklist(): boolean {
    return this.collection === '/api/roles' && !this.isNew() && !!this.model()?.entity.entityId;
  }

  /** The page of this entry on the public site (a saved post or page with a slug), opened in a new tab; null for anything else. */
  protected get viewRoute(): string[] | null {
    const base = this.collection === '/api/posts' ? '/post' : this.collection === '/api/pages' ? '/page' : null;
    const slug = this.model()?.entity.values['Slug'];
    return base && slug && !this.isNew() ? [base, slug] : null;
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
      case 'approve':
        return 'thumb_up';
      case 'request-changes':
        return 'rate_review';
      case 'set-password':
        return 'key';
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

  /** Relations whose Add row holds a choice that was never added; a Save over it is refused, not silently dropped. */
  private readonly pendingRelations = new Set<string>();

  protected setPending(relation: string, pending: boolean): void {
    if (pending) {
      this.pendingRelations.add(relation);
    } else {
      this.pendingRelations.delete(relation);
    }
  }

  protected onSave(values: Record<string, string | null>): void {
    const current = this.model();
    if (!current || this.saveState() === 'saving') {
      return;
    }

    if (this.pendingRelations.size > 0) {
      // the error block next to the Save button only shows in the error state: setting the message alone left the refusal invisible
      this.saveErrors.set(['A row is chosen but not added: press Add (or clear the choice) before you save.']);
      this.saveState.set('error');
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
  /** A password an administrator just generated: shown once, never kept after this panel is closed. */
  protected readonly oneTimeLogin = signal<{ username: string; password: string } | null>(null);
  protected readonly oneTimeCopied = signal(false);

  protected async copyOneTime(): Promise<void> {
    const login = this.oneTimeLogin();
    if (!login) {
      return;
    }

    try {
      await navigator.clipboard.writeText(login.password);
      this.oneTimeCopied.set(true);
    } catch {
      this.oneTimeCopied.set(false);
    }
  }

  protected closeOneTime(): void {
    this.oneTimeLogin.set(null);
    this.oneTimeCopied.set(false);
  }

  protected runAction(action: EntityAction): void {
    if (action.confirm && !window.confirm(action.confirm)) {
      return;
    }

    this.saveErrors.set([]);
    this.oneTimeLogin.set(null);
    this.api.runAction<unknown>(action.link).subscribe({
      next: (result) => {
        // an action that hands back a password (Set password): show it once, here, and nowhere else
        const login = result as { username?: string; password?: string } | null;
        if (login && typeof login === 'object' && login.username && login.password) {
          this.oneTimeLogin.set({ username: login.username, password: login.password });
        }

        this.reload();
      },
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
