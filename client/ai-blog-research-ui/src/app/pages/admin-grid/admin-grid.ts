// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap, throwError } from 'rxjs';
import { EntityGrid, GridRequest } from '../../components/entity-grid/entity-grid';
import { LabelPipe } from '../../i18n/labels';
import { describeApiError } from '../../models/api-error';
import { EntityGridModel } from '../../models/entity-form.model';
import { EntityApiService } from '../../services/entity-api.service';

/**
 * One admin list screen for every entity collection: the route says which (data: collection and title), the server says
 * everything else (columns, order, paging, links). It fetches the grid model, renders it with the reusable grid, and turns the
 * grid requests (next, previous, sort, open) into a server-supplied link, a sorted first page, or a navigation to the entity
 * screen. Roles, Posts, Pages later are one route each.
 */
@Component({
  selector: 'app-admin-grid',
  imports: [EntityGrid, MatButtonModule, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './admin-grid.html',
  styleUrl: './admin-grid.scss',
})
export class AdminGrid implements OnInit {
  private readonly api = inject(EntityApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly title = signal('');
  protected readonly model = signal<EntityGridModel | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errors = signal<string[]>([]);

  private collection = '';

  ngOnInit(): void {
    this.collection = this.route.snapshot.data['collection'] as string;
    this.title.set(this.route.snapshot.data['title'] as string);
    this.load(this.api.grid(this.collection));
  }

  /** New: the empty form of this collection (only offered when the server says the caller may create and gave a create link). */
  /** The public route prefix of this collection (posts and pages have a page on the site), or null. */
  protected get viewBase(): string | null {
    return this.collection === '/api/posts' ? '/post' : this.collection === '/api/pages' ? '/page' : null;
  }

  protected get canCreate(): boolean {
    const grid = this.model();
    return grid?.canCreate === true && !!grid.links?.create;
  }

  /** The value chosen in a filter dropdown ("" is all): the first page of the list again, filtered by the server. */
  protected onFilter(field: string, value: string): void {
    const current = this.model();
    this.load(this.api.grid(this.collection, { pageSize: current?.paging?.pageSize, filter: value ? field : null, filterValue: value }));
  }

  protected selectedFilterValue(): string {
    return this.model()?.paging?.filterValue ?? '';
  }

  protected create(): void {
    void this.router.navigate(['new'], { relativeTo: this.route });
  }

  protected onRequest(request: GridRequest): void {
    const current = this.model();
    if (!current) {
      return;
    }

    switch (request.kind) {
      case 'next':
        if (current.links?.next) {
          this.load(this.api.followGrid(current.links.next));
        }
        break;
      case 'previous':
        if (current.links?.previous) {
          this.load(this.api.followGrid(current.links.previous));
        }
        break;
      case 'sort':
        this.load(
          this.api.grid(this.collection, {
            sort: request.field,
            descending: request.descending,
            pageSize: current.paging?.pageSize,
            filter: current.paging?.filter,
            filterValue: current.paging?.filterValue,
          }),
        );
        break;
      case 'toggle':
        this.togglePublished(request);
        break;
      case 'open':
        // the link is the server's; it travels with the navigation so the entity screen follows it instead of building a URL
        void this.router.navigate([request.entityId], { relativeTo: this.route, state: { link: request.link } });
        break;
    }
  }

  /**
   * Publishes or unpublishes from the list. Reads the entry's form and does what the server offers there: the publish or
   * unpublish action (posts, where the state is server-managed), else a save with the flag flipped (pages, where it is an
   * ordinary field). Then the same list page is read again, so what the row shows is what the server holds.
   */
  private togglePublished(request: Extract<GridRequest, { kind: 'toggle' }>): void {
    this.errors.set([]);
    this.api
      .form(request.link)
      .pipe(
        switchMap((form) => {
          const action = form.actions?.find((a) => a.name === (request.value ? 'publish' : 'unpublish'));
          if (action) {
            return this.api.runAction(action.link);
          }

          const field = form.schema.fields.find((f) => f.name === request.field);
          if (field && field.isReadOnly !== true) {
            const values: Record<string, string | null> = {};
            for (const [name, value] of Object.entries(form.entity.values)) {
              values[name] = value ?? '';
            }
            values[request.field] = String(request.value);
            return this.api.update(request.link, form.entity.entityId, values);
          }

          return throwError(() => new Error('not available'));
        }),
      )
      .subscribe({
        next: () => this.refresh(false),
        error: (error) => {
          this.errors.set(describeApiError(error, 'This entry cannot be published or unpublished from the list.'));
          this.refresh(true);
        },
      });
  }

  /** Reads the current list page again; after a failure the rows are dropped first so a flipped switch goes back to what the server holds. */
  private refresh(dropRows: boolean): void {
    const self = this.model()?.links?.self;
    if (!self) {
      return;
    }
    if (dropRows) {
      this.model.set(null);
    }
    this.load(this.api.followGrid(self));
  }

  private load(source: ReturnType<EntityApiService['grid']>): void {
    this.isLoading.set(true);
    this.errors.set([]);
    source.subscribe({
      next: (grid) => {
        this.model.set(grid);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errors.set(describeApiError(error, 'Could not load the list.'));
      },
    });
  }
}
