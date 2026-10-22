import { DraftBadge } from '../draft-badge/draft-badge';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { PublicContentService, PublicMenuItem } from '../../services/public-content.service';

/**
 * The site menu in the header: Home (only when a front page is pinned), Posts, then the published pages the author chose to show in the list, with their sub-pages.
 * The list comes from the public API (the page tree), so adding a page in the admin adds it here without a client release. It is
 * read again after every navigation: the app never reloads between the admin and the site, so a page published a moment ago must
 * show up the next time the visitor (or the author) moves anywhere, not only after a browser refresh.
 */
@Component({
  selector: 'app-site-nav',
  imports: [RouterLink, RouterLinkActive, DraftBadge],
  templateUrl: './site-nav.html',
  styleUrl: './site-nav.scss',
})
export class SiteNav implements OnInit {
  private readonly content = inject(PublicContentService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<PublicMenuItem[]>([]);

  /** True when a published page is pinned as the front page; without one there is no Home link and the site opens on Posts (as BlogEngine.NET does). */
  protected readonly hasHome = signal(false);

  ngOnInit(): void {
    this.load();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.load());
  }

  private load(): void {
    this.content.menu().subscribe({
      next: (menu) => this.items.set(menu),
      error: () => this.items.set([]),
    });
    this.content.home().subscribe({
      next: () => this.hasHome.set(true),
      error: () => this.hasHome.set(false),
    });
  }
}
