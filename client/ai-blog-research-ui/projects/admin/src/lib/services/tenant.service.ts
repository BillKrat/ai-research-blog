import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { ActingTenantService, API_BASE_URL } from '@adventures/core';

/**
 * The tenant this visit is for, as the server worked it out: Domain (the host names it), Fallback (a development stand-in), Acting (the person chose it in the
 * switcher) or None.
 */
export interface CurrentTenant {
  host: string;
  tenant: { id: string; name: string | null; domain: string | null } | null;
  match: 'Domain' | 'Fallback' | 'Acting' | 'Mirror' | 'None';
  /** While this address mirrors another site (match Mirror): the site the address itself belongs to, whose own configuration is ignored for now. */
  own?: { id: string; domain: string | null } | null;
}

/** A tenant with the host names that reach it: its own domain and its aliases. */
export interface TenantHosts {
  id: string;
  name: string;
  domain: string;
  aliases: string[];
  /** The id of the tenant whose configuration this one uses while a mirror pointer is set (empty or missing: its own). */
  mirrors?: string | null;
}

/**
 * Which tenant the person is working in, the tenants they may switch to, and (for a platform administrator) which host names reach which tenant. The client decides
 * nothing from any of it: the server checks the chosen tenant on every call and answers 403 for one the person may not act in.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);
  private readonly acting = inject(ActingTenantService);

  private readonly _current = signal<CurrentTenant | null>(null);
  readonly current = this._current.asReadonly();

  private readonly _mine = signal<TenantHosts[]>([]);
  /** The tenants this person may work in (the switcher's list). */
  readonly mine = this._mine.asReadonly();

  private readonly _all = signal<TenantHosts[]>([]);
  /** Every tenant with its host names; filled only for a platform administrator. */
  readonly all = this._all.asReadonly();

  private readonly _platform = signal(false);
  /** Whether the person holds the platform right here (the server's answer; the server refuses the calls it guards regardless). */
  readonly isPlatform = this._platform.asReadonly();

  private readonly _problem = signal('');
  readonly problem = this._problem.asReadonly();

  private readonly _notice = signal('');
  /** What the last change did, in plain words (cleared when the next one starts). */
  readonly notice = this._notice.asReadonly();

  load(): void {
    this.http.get<CurrentTenant>(`${this.apiUrl}/api/tenant/current`).subscribe({
      next: (current) => this._current.set(current),
      error: () => this._current.set(null),
    });
    this.http.get<{ actingId: string | null; tenants: TenantHosts[] }>(`${this.apiUrl}/api/tenant/mine`).subscribe({
      next: (answer) => this._mine.set(answer.tenants),
      error: () => this._mine.set([]),
    });
    this.http.get<{ rights: { name: string }[] }>(`${this.apiUrl}/api/auth/rights`).subscribe({
      next: (answer) => {
        const platform = answer.rights.some((right) => right.name === 'platform.manage');
        this._platform.set(platform);
        if (platform) {
          this.loadHosts();
        }
      },
      error: () => this._platform.set(false),
    });
  }

  /** Works in another tenant: remembers the choice and reloads, so every screen shows what that tenant holds and what this person may do there. */
  choose(tenantId: string): void {
    this.acting.choose(tenantId);
    this.acting.reload();
  }

  /** Shows a problem on the Tenants screen (for a check the screen makes before it sends anything). */
  fail(message: string): void {
    this._notice.set('');
    this._problem.set(message);
  }

  /** Creates a tenant on a domain from a name and the domain. The server refuses a domain another tenant already reaches, an address or localhost, and says why. */
  createTenant(name: string, domain: string, done?: () => void): void {
    this._problem.set('');
    this._notice.set('');
    this.http.post<TenantHosts>(`${this.apiUrl}/api/tenant`, { name, domain }).subscribe({
      next: (created) => {
        this._notice.set(`Created ${created.name} on ${created.domain}. Its domain works now; add the people who run it under Users.`);
        this.loadHosts();
        done?.();
      },
      error: (error) => this._problem.set(this.messageOf(error, 'The tenant was not created.')),
    });
  }

  /** Makes a host name reach the tenant (it mirrors the tenant's domain). The server refuses a name that already reaches another tenant. */
  addAlias(tenantId: string, host: string, done?: () => void): void {
    this._problem.set('');
    this._notice.set('');
    this.http.put<string[]>(`${this.apiUrl}/api/tenant/${encodeURIComponent(tenantId)}/aliases`, { host }).subscribe({
      next: () => {
        this._notice.set(`Added ${this.nameOf(host)}. It works now.`);
        this.loadHosts();
        done?.();
      },
      error: (error) => this._problem.set(this.messageOf(error, 'The host was not added.')),
    });
  }

  /**
   * Sets or clears a tenant's mirror pointer ("use the configuration of"); a null target clears it. The tenant's own record and data are untouched. The server refuses a
   * target that is unknown, itself or already mirroring, and setting it from the tenant's own address (the person would be locked out), and says why.
   */
  setMirror(tenantId: string, targetId: string | null, done?: () => void): void {
    this._problem.set('');
    this._notice.set('');
    this.http.put(`${this.apiUrl}/api/tenant/${encodeURIComponent(tenantId)}/mirror`, { target: targetId }).subscribe({
      next: () => {
        this._notice.set(targetId ? 'Saved. That site now shows the other site configuration; its own is kept and ignored until you choose none.' : 'Saved. That site uses its own configuration again.');
        this.loadHosts();
        this.load();
        done?.();
      },
      error: (error) => this._problem.set(this.messageOf(error, 'The mirror was not changed.')),
    });
  }

  removeAlias(tenantId: string, host: string): void {
    this._problem.set('');
    this._notice.set('');
    this.http.delete<string[]>(`${this.apiUrl}/api/tenant/${encodeURIComponent(tenantId)}/aliases/${encodeURIComponent(host)}`).subscribe({
      next: () => {
        this._notice.set(`Removed ${host}.`);
        this.loadHosts();
      },
      error: (error) => this._problem.set(this.messageOf(error, 'The host was not removed.')),
    });
  }

  /**
   * Deletes a tenant (a soft delete on the server: its domain and host names reach nothing afterwards). The tenant's own domain is sent as the confirmation; the server
   * refuses the tenant being worked in, the tenant that owns this host and the last tenant, and says why.
   */
  deleteTenant(tenantId: string, name: string, confirm: string, done?: () => void): void {
    this._problem.set('');
    this._notice.set('');
    this.http.delete(`${this.apiUrl}/api/tenant/${encodeURIComponent(tenantId)}`, { params: { confirm } }).subscribe({
      next: () => {
        this._notice.set(`Deleted ${name}. Its host names no longer reach anything.`);
        this.loadHosts();
        done?.();
      },
      error: (error) => this._problem.set(this.messageOf(error, 'The tenant was not deleted.')),
    });
  }

  /** Reads every tenant with its host names (platform administrators only; the server refuses anyone else). */
  loadHosts(): void {
    this.http.get<TenantHosts[]>(`${this.apiUrl}/api/tenant/hosts`).subscribe({
      next: (all) => this._all.set(all),
      error: () => this._all.set([]),
    });
  }

  private nameOf(host: string): string {
    return host.replace(/^[a-z]+:\/\//i, '').split(/[/:?#]/)[0].toLowerCase();
  }

  private messageOf(error: unknown, fallback: string): string {
    const body = (error as { error?: unknown })?.error;
    return typeof body === 'string' && body.length > 0 ? body : fallback;
  }
}
