// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageBannerService } from '@adventures/core';
import { AdminMenuService, AuthService } from '@adventures/core';
import { TenantService } from '../../services/tenant.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '@adventures/entity-ui';

/**
 * The admin area frame: the server-supplied menu on the left (sections, items, a count badge, items for screens that are not
 * built yet shown dimmed) and the screen on the right. It renders what the server sends and nothing else: no list of screens,
 * no role checks. It loads the tenant facts once for every screen (the tenant panel on the Dashboard shows them).
 */
@Component({
  selector: 'adv-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule, MatButtonModule, MatTooltipModule, LabelPipe],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell implements OnInit {
  private readonly menuService = inject(AdminMenuService);
  private readonly tenantService = inject(TenantService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly username = this.auth.username;

  /** While this address mirrors another site: which site it shows, and which address it is (a notice on every admin screen, because edits change the other site). */
  protected readonly mirroring = computed(() => {
    const current = this.tenantService.current();
    return current?.match === 'Mirror' ? { shows: current.tenant?.domain ?? '', own: current.own?.domain ?? current.host } : null;
  });

  /** The address the person is on: the section that holds it opens by itself, like the legacy menu. */
  private readonly url = signal(this.router.url);

  /** The section the person opened or closed by hand; undefined until they do, and forgotten on the next navigation so the menu follows the page again. */
  private readonly chosen = signal<string | null | undefined>(undefined);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.url.set(event.urlAfterRedirects);
        this.chosen.set(undefined);
      }
    });
  }

  /** Only one section is open at a time (the legacy menu); with the icons-only menu every entry shows. */
  protected isOpen(section: { id: string; items: { route?: string | null }[] }): boolean {
    if (this.collapsed()) {
      return true;
    }
    const chosen = this.chosen();
    if (chosen !== undefined) {
      return chosen === section.id;
    }
    const here = this.url().split(/[?#]/)[0];
    return section.items.some((item) => !!item.route && (here === item.route || here.startsWith(item.route + '/')));
  }

  protected toggleSection(section: { id: string; items: { route?: string | null }[] }): void {
    this.chosen.set(this.isOpen(section) ? null : section.id);
  }

  /** A section with exactly one built entry is that entry's link (Dashboard); it has no accordion. */
  protected direct(section: { items: { route?: string | null; available: boolean }[] }): boolean {
    return section.items.length === 1 && section.items[0].available && !!section.items[0].route;
  }

  /** The count of waiting things in a section, shown on its heading while it is closed so nothing waiting is hidden. */
  protected waiting(section: { items: { badge?: number | null }[] }): number {
    return section.items.reduce((sum, item) => sum + (item.badge ?? 0), 0);
  }

  protected logOff(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }

  protected readonly menu = this.menuService.menu;

  /** What the current page says it is showing, drawn across the top of the admin area (see the standard page header). */
  protected readonly banner = inject(PageBannerService).banner;

  /** Whether the menu shows icons only, to give the screen more room. Remembered in this browser (a per-viewer convenience; storage may be refused). */
  protected readonly collapsed = signal(AdminShell.readCollapsed());

  protected toggle(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(AdminShell.storageKey, String(next));
    } catch {
      // storage is a convenience only
    }
  }

  private static readonly storageKey = "adv.admin-menu-collapsed";

  private static readCollapsed(): boolean {
    try {
      return localStorage.getItem(AdminShell.storageKey) === "true";
    } catch {
      return false;
    }
  }

  ngOnInit(): void {
    this.menuService.load();
    this.tenantService.load();
  }
}
