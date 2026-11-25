import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PageHeader } from '../../components/page-header/page-header';
import { TenantHosts, TenantService } from '../../services/tenant.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '@adventures/entity-ui';

/**
 * Admin > Tenants (platform administrators): each tenant with the host names that reach it, and a field to add one (for example a site's temporary address).
 * The server checks the right and the rules (a plain host name, one tenant per name) and clears its kept answers on every change, so a saved name works at once.
 */
@Component({
  selector: 'adv-admin-tenants',
  imports: [PageHeader, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './admin-tenants.html',
  styleUrl: './admin-tenants.scss',
})
export class AdminTenants implements OnInit {
  private readonly service = inject(TenantService);

  protected readonly tenants = this.service.all;
  protected readonly problem = this.service.problem;
  protected readonly notice = this.service.notice;
  protected readonly draft = signal<Record<string, string>>({});

  /** The tenants this person may work in and the one they work in now: the same switcher as the Dashboard panel, here so a refused delete can be fixed on this page. */
  protected readonly mine = this.service.mine;
  protected readonly workingIn = computed(() => this.service.current()?.tenant?.id ?? '');

  protected workIn(tenantId: string): void {
    this.service.choose(tenantId);
  }

  ngOnInit(): void {
    this.service.loadHosts();
  }

  protected readonly newName = signal('');
  protected readonly newDomain = signal('');

  protected createTenant(): void {
    if (this.newName().trim() === '' || this.newDomain().trim() === '') {
      this.service.fail('Give the new tenant a name and a domain.');
      return;
    }

    this.service.createTenant(this.newName().trim(), this.newDomain().trim(), () => {
      this.newName.set('');
      this.newDomain.set('');
    });
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

  /** What has been chosen in each tenant's "use the configuration of" list but not applied yet (empty string: its own). */
  protected readonly mirrorChoice = signal<Record<string, string>>({});

  protected chosenMirror(entry: TenantHosts): string {
    return this.mirrorChoice()[entry.id] ?? entry.mirrors ?? '';
  }

  protected setMirrorChoice(tenantId: string, value: string): void {
    this.mirrorChoice.update((all) => ({ ...all, [tenantId]: value }));
  }

  /** The sites this one may use: not itself and not a site that mirrors (one level only; the server checks again). */
  protected mirrorTargets(entry: TenantHosts): TenantHosts[] {
    return this.tenants().filter((other) => other.id !== entry.id && !other.mirrors);
  }

  protected applyMirror(entry: TenantHosts): void {
    const target = this.chosenMirror(entry);
    this.service.setMirror(entry.id, target === '' ? null : target, () => this.mirrorChoice.update((all) => Object.fromEntries(Object.entries(all).filter(([id]) => id !== entry.id))));
  }

  protected remove(tenantId: string, alias: string): void {
    this.service.removeAlias(tenantId, alias);
  }
}
