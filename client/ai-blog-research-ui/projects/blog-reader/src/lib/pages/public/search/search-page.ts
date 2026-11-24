import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { describeApiError } from '@adventures/core';
import { LabelPipe } from '@adventures/entity-ui';
import { PublicContentService, SearchResult } from '../../../services/public-content.service';

/**
 * Search of the blog's own posts and pages. The query lives in the address (`/search?q=...&page=2`), so a search can be linked and the back button
 * works. The snippet is plain text from the server and is shown as text. The server limits the query and the rate; its refusal is shown as it is.
 */
@Component({
  selector: 'adv-search-page',
  imports: [DatePipe, RouterLink, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './search-page.html',
  styleUrl: './search-page.scss',
})
export class SearchPage implements OnInit {
  private readonly content = inject(PublicContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly typed = signal('');
  protected readonly result = signal<SearchResult | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly searching = signal(false);
  private current = { q: '', page: 1 };

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const q = (params.get('q') ?? '').trim();
      const page = Math.max(1, Number(params.get('page')) || 1);
      this.current = { q, page };
      this.typed.set(q);
      this.run(q, page);
    });
  }

  protected submit(): void {
    void this.router.navigate([], { queryParams: { q: this.typed().trim(), page: 1 } });
  }

  protected go(delta: number): void {
    void this.router.navigate([], { queryParams: { q: this.current.q, page: this.current.page + delta } });
  }

  protected get totalPages(): number {
    const r = this.result();
    return r ? Math.max(1, Math.ceil(r.total / r.pageSize)) : 1;
  }

  private run(q: string, page: number): void {
    this.errors.set([]);
    if (q === '') {
      this.result.set(null);
      return;
    }

    this.searching.set(true);
    this.content.search(q, page).subscribe({
      next: (result) => {
        this.searching.set(false);
        this.result.set(result);
      },
      error: (error) => {
        this.searching.set(false);
        this.result.set(null);
        this.errors.set(error?.status === 429 ? ['You are searching too fast. Please wait a minute and try again.'] : describeApiError(error, "Couldn't search. Try again."));
      },
    });
  }
}
