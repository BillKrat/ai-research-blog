import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TenantService } from '../../services/tenant.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '@adventures/entity-ui';

/**
 * The tenant the domain names, the tenants this person may work in, and (for a platform administrator) the host names. It lives on the
 * Dashboard only. It shows the signals of <see cref="TenantService"/>; the admin frame loads them once for every screen.
 */
@Component({
  selector: 'adv-tenant-panel',
  imports: [MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './tenant-panel.html',
  styleUrl: './tenant-panel.scss',
})
export class TenantPanel {
  private readonly tenantService = inject(TenantService);

  protected readonly tenant = this.tenantService.current;
  protected readonly tenants = this.tenantService.mine;
  protected readonly allTenants = this.tenantService.all;
  protected readonly isPlatform = this.tenantService.isPlatform;
  protected readonly problem = this.tenantService.problem;

  /** Work in another tenant: the choice is remembered and the page reloads, so every screen shows what that tenant holds. */
  protected choose(tenantId: string): void {
    this.tenantService.choose(tenantId);
  }

  /** Stops this address mirroring another site: its own configuration is used again (platform administrators only; the server checks). */
  protected stopMirroring(ownTenantId: string): void {
    this.tenantService.setMirror(ownTenantId, null);
  }

  protected removeAlias(tenantId: string, alias: string): void {
    this.tenantService.removeAlias(tenantId, alias);
  }
}
