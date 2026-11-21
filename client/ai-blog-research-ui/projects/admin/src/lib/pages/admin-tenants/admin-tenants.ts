import { Component, OnInit, inject, signal } from '@angular/core';
import { PageHeader } from '../../components/page-header/page-header';
import { TenantHosts, TenantService } from '../../services/tenant.service';

/**
 * Admin > Tenants (platform administrators): each tenant with the host names that reach it, and a field to add one (for example a site's temporary address).
 * The server checks the right and the rules (a plain host name, one tenant per name) and clears its kept answers on every change, so a saved name works at once.
 */
@Component({
  selector: 'adv-admin-tenants',
  imports: [PageHeader],
  templateUrl: './admin-tenants.html',
  styleUrl: './admin-tenants.scss',
})
export class AdminTenants implements OnInit {
  private readonly service = inject(TenantService);

  protected readonly tenants = this.service.all;
  protected readonly problem = this.service.problem;
  protected readonly notice = this.service.notice;
  protected readonly draft = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.service.loadHosts();
  }

  protected setDraft(tenantId: string, value: string): void {
    this.draft.update((all) => ({ ...all, [tenantId]: value }));
  }

  protected add(entry: TenantHosts): void {
    const host = (this.draft()[entry.id] ?? '').trim();
    if (host === '') {
      return;
    }

    this.service.addAlias(entry.id, host, () => this.setDraft(entry.id, ''));
  }

  /** The tenant whose delete confirmation is open, and what has been typed into it. */
  protected readonly deleting = signal<string | null>(null);
  protected readonly confirmText = signal('');

  protected startDelete(tenantId: string): void {
    this.confirmText.set('');
    this.deleting.set(tenantId);
  }

  protected cancelDelete(): void {
    this.deleting.set(null);
    this.confirmText.set('');
  }

  /** True when what was typed is this tenant's domain (the server checks again; this only keeps the button honest). */
  protected matches(entry: TenantHosts): boolean {
    return this.hostOf(this.confirmText()) === this.hostOf(entry.domain) && this.hostOf(entry.domain) !== '';
  }

  protected confirmDelete(entry: TenantHosts): void {
    if (!this.matches(entry)) {
      return;
    }

    this.service.deleteTenant(entry.id, entry.name, this.confirmText().trim(), () => this.cancelDelete());
  }

  private hostOf(value: string): string {
    return value.trim().replace(/^[a-z]+:\/\//i, '').split(/[/:?#]/)[0].toLowerCase();
  }

  protected remove(tenantId: string, alias: string): void {
    this.service.removeAlias(tenantId, alias);
  }
}
