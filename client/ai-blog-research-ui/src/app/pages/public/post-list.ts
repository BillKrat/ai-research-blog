import { DraftBadge } from '../../components/draft-badge/draft-badge';
import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicContentService, PublicPostList } from '../../services/public-content.service';

/**
 * The list of published posts, newest first, with paging; also serves a category (/category/:name) or a tag (/tag/:name), the
 * route says which. Reads only the anonymous public API.
 */
@Component({
  selector: 'app-post-list',
  imports: [RouterLink, DatePipe, DraftBadge],
  templateUrl: './post-list.html',
  styleUrl: './public.scss',
})
export class PostList implements OnInit {
  private readonly content = inject(PublicContentService);
  private readonly route = inject(ActivatedRoute);

  protected readonly list = signal<PublicPostList | null>(null);
  protected readonly heading = signal('Posts');
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);

  private category: string | null = null;
  private tag: string | null = null;

  ngOnInit(): void {
    // the same component serves /posts, /category/:name and /tag/:name, so react to the route, not just the first one
    this.route.paramMap.subscribe((params) => {
      this.category = this.route.snapshot.data['kind'] === 'category' ? params.get('name') : null;
      this.tag = this.route.snapshot.data['kind'] === 'tag' ? params.get('name') : null;
      this.heading.set(this.category ? `Category: ${this.category}` : this.tag ? `Tag: ${this.tag}` : 'Posts');
      this.load(1);
    });
  }

  protected go(page: number): void {
    this.load(page);
  }

  private load(page: number): void {
    this.isLoading.set(true);
    this.failed.set(false);
    this.content.posts(page, 10, this.category, this.tag).subscribe({
      next: (list) => {
        this.list.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected get totalPages(): number {
    const list = this.list();
    return list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;
  }
}
