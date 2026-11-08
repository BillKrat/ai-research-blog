// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AdminMenuService } from '../../services/admin-menu.service';
import { TenantService } from '../../services/tenant.service';

/**
 * The admin area frame: the server-supplied menu on the left (sections, items, a count badge, items for screens that are not
 * built yet shown dimmed) and the screen on the right. It renders what the server sends and nothing else: no list of screens,
 * no role checks.
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
  protected readonly tenant = this.tenantService.current;
  protected readonly tenants = this.tenantService.mine;
  protected readonly allTenants = this.tenantService.all;
  protected readonly isPlatform = this.tenantService.isPlatform;
  protected readonly problem = this.tenantService.problem;

  ngOnInit(): void {
    this.menuService.load();
    this.tenantService.load();
  }

  /** Work in another tenant: the choice is remembered and the page reloads, so every screen shows what that tenant holds. */
  protected choose(tenantId: string): void {
    this.tenantService.choose(tenantId);
  }

  /** Make this host reach the tenant (platform administrators only; the server checks). */
  protected mirror(host: string, tenantId: string): void {
    if (tenantId === '') {
      // "Default": the host goes back to reaching whatever its own name reaches (no alias)
      this.tenantService.resetAlias(host);
      return;
    }

    this.tenantService.addAlias(tenantId, host);
  }

  protected removeAlias(tenantId: string, alias: string): void {
    this.tenantService.removeAlias(tenantId, alias);
  }
}
