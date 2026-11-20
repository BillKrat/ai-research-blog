import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, expand, forkJoin, map, reduce } from 'rxjs';
import { API_BASE_URL, EntityApiService, EntityGridModel, bindSpinner, describeApiError } from '@adventures/core';
import { CloudTag, LabelPipe, TagCloud } from '@adventures/entity-ui';
import { PageHeader } from '../../components/page-header/page-header';

interface PublicTerm {
  name: string;
  posts: number;
}

/**
 * The Tags screen: a tag cloud instead of a plain list. Each tag is sized by how many posts use it, a click lists those posts
 * (the public tag page), and the pencil opens the tag's own edit screen. The tags come from the admin collection (every page of it,
 * so the cloud is whole) and the counts from the public tag totals, which count drafts for a signed-in administrator.
 */
@Component({
  selector: 'adv-admin-tags',
  imports: [PageHeader, TagCloud, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './admin-tags.html',
  styleUrl: './admin-tags.scss',
})
export class AdminTags implements OnInit {
  private readonly api = inject(EntityApiService);
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  protected readonly tags = signal<CloudTag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errors = signal<string[]>([]);
  protected readonly canCreate = signal(false);
  private readonly gears = bindSpinner(this.isLoading);

  ngOnInit(): void {
    const everyTag = this.api.grid('/api/tags', { pageSize: 100 }).pipe(
      expand((grid) => (grid.links?.next ? this.api.followGrid(grid.links.next) : EMPTY)),
      reduce((all: EntityGridModel[], grid) => [...all, grid], []),
    );
    const uses = this.http.get<PublicTerm[]>(`${this.apiBase}/api/public/tags`).pipe(map((terms) => terms ?? []));

    forkJoin([everyTag, uses]).subscribe({
      next: ([grids, terms]) => {
        const counts = new Map(terms.map((term) => [term.name.toLowerCase(), term.posts]));
        const cloud = grids
          .flatMap((grid) => grid.rows)
          .map((row) => {
            const key = Object.keys(row.values).find((k) => k.toLowerCase() === 'name');
            const name = (key ? row.values[key] : null) ?? '';
            return { name, count: counts.get(name.toLowerCase()) ?? 0, link: ['/tag', name], editLink: ['/admin/tags', row.entityId] } as CloudTag;
          })
          .filter((tag) => tag.name !== '')
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        this.canCreate.set(grids[0]?.canCreate === true);
        this.tags.set(cloud);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errors.set(describeApiError(error, "Couldn't load the tags."));
      },
    });
  }
}
