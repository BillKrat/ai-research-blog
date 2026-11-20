import { Injectable, signal } from '@angular/core';

/** What the banner under the site menu says, and the one optional action beside it (for example "Show all"). */
export interface PageBanner {
  text: string;
  actionLabel?: string;
  action?: () => void;
}

/**
 * The standard place for a page to say what it is showing ("Showing the 4 occurrences of ..."): a banner across the top of the
 * admin area, under the site menu. A page sets it and clears it when it goes away; the shell draws it.
 */
@Injectable({ providedIn: 'root' })
export class PageBannerService {
  readonly banner = signal<PageBanner | null>(null);

  show(banner: PageBanner): void {
    this.banner.set(banner);
  }

  clear(): void {
    this.banner.set(null);
  }
}
