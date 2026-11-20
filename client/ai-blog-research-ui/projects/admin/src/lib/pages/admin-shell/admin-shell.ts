// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PageBannerService } from '@adventures/core';
import { AdminMenuService } from '../../services/admin-menu.service';
import { TenantService } from '../../services/tenant.service';

/**
 * The admin area frame: the server-supplied menu on the left (sections, items, a count badge, items for screens that are not
 * built yet shown dimmed) and the screen on the right. It renders what the server sends and nothing else: no list of screens,
 * no role checks. It loads the tenant facts once for every screen (the tenant panel on the Dashboard shows them).
 */
@Component({
  selector: 'adv-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell implements OnInit {
  private readonly menuService = inject(AdminMenuService);
  private readonly tenantService = inject(TenantService);

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
