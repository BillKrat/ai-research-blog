import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PublicContentService, PublicMenuItem } from '../../services/public-content.service';

/**
 * The site menu in the header: Home, Posts, then the published pages the author chose to show in the list, with their sub-pages.
 * The list comes from the public API (the page tree), so adding a page in the admin adds it here without a client release.
 */
@Component({
  selector: 'app-site-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-nav.html',
  styleUrl: './site-nav.scss',
})
export class SiteNav implements OnInit {
  private readonly content = inject(PublicContentService);

  protected readonly items = signal<PublicMenuItem[]>([]);

  ngOnInit(): void {
    this.content.menu().subscribe({
      next: (menu) => this.items.set(menu),
      error: () => this.items.set([]),
    });
  }
}
