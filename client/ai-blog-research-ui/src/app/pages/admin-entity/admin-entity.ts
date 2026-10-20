import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router } from '@angular/router';
import { EntityForm } from '../../components/entity-form/entity-form';
import { RelationGrid } from '../../components/relation-grid/relation-grid';
import { describeApiError } from '../../models/api-error';
import { EntityFormModel } from '../../models/entity-form.model';
import { EntityApiService } from '../../services/entity-api.service';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * One admin screen for any single entity: its form (typed controls, read-only fields and the Save button decided by the
 * server) and under it one read-only grid per child collection the schema declares (a user role assignments). The form
 * link comes from the grid row the user opened; opened directly (a reload, a bookmark) it falls back to the collection path
 * plus the id, the one URL shape the screen knows.
 */
@Component({
  selector: 'app-admin-entity',
  imports: [MatButtonModule, EntityForm, RelationGrid],
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
  protected readonly loadErrors = signal<string[]>([]);
  protected readonly saveState = signal<SaveState>('idle');
  protected readonly saveErrors = signal<string[]>([]);

  private link = '';

  ngOnInit(): void {
    const collection = this.route.snapshot.data['collection'] as string;
    this.title.set(this.route.snapshot.data['title'] as string);
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const handedOver = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as { link?: string } | undefined;
    this.link = handedOver?.link ?? `${collection}/${encodeURIComponent(id)}`;

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
      error: (error) => this.loadErrors.set(describeApiError(error, 'Could not refresh this entry.')),
    });
  }

  protected back(): void {
    void this.router.navigate(['..'], { relativeTo: this.route });
  }

  protected onSave(values: Record<string, string | null>): void {
    const current = this.model();
    if (!current || this.saveState() === 'saving') {
      return;
    }

    this.saveState.set('saving');
    this.saveErrors.set([]);
    this.api.update(this.link, current.entity.entityId, values).subscribe({
      next: (form) => {
        this.model.set(form);
        this.saveState.set('saved');
      },
      error: (error) => {
        this.saveErrors.set(describeApiError(error, 'Could not save.'));
        this.saveState.set('error');
      },
    });
  }
}
