import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MarkdownContent } from '../../components/markdown-content/markdown-content';
import { PublicContentService, PublicPage } from '../../services/public-content.service';

/**
 * One published page by slug (/page/:slug), or, with route data front = true, the front page at the home address: when the site has
 * no front page yet it shows a welcome with a link to the posts, so the home address is never empty.
 */
@Component({
  selector: 'app-page-view',
  imports: [RouterLink, MarkdownContent],
  templateUrl: './page-view.html',
  styleUrl: './public.scss',
})
export class PageView implements OnInit {
  private readonly content = inject(PublicContentService);
  private readonly route = inject(ActivatedRoute);

  protected readonly page = signal<PublicPage | null>(null);
  protected readonly notFound = signal(false);
  protected readonly isLoading = signal(true);

  protected get isFront(): boolean {
    return this.route.snapshot.data['front'] === true;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.isLoading.set(true);
      this.notFound.set(false);
      const source = this.isFront ? this.content.home() : this.content.page(params.get('slug') ?? '');
      source.subscribe({
        next: (page) => {
          this.page.set(page);
          this.isLoading.set(false);
        },
        error: () => {
          this.page.set(null);
          this.notFound.set(true);
          this.isLoading.set(false);
        },
      });
    });
  }
}
