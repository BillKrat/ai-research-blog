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
  match: 'Domain' | 'Fallback' | 'Acting' | 'None';
}

/** A tenant with the host names that reach it: its own domain and its aliases. */
export interface TenantHosts {
  id: string;
  name: string;
  domain: string;
  aliases: string[];
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

  /** Makes a host name reach the tenant (it mirrors the tenant's domain). The server refuses a name that already reaches another tenant. */
  addAlias(tenantId: string, host: string): void {
    this._problem.set('');
    this.http.put<string[]>(`${this.apiUrl}/api/tenant/${encodeURIComponent(tenantId)}/aliases`, { host }).subscribe({
      next: () => this.loadHosts(),
      error: (error) => this._problem.set(this.messageOf(error, 'The host was not added.')),
    });
  }

  /** Takes this host back to its default: removes it from whichever tenant mirrors it. Says so when it mirrors none. */
  resetAlias(host: string): void {
    const name = host.replace(/^[a-z]+:\/\//i, '').split(/[/:?#]/)[0].toLowerCase();
    const owner = this._all().find((tenant) => tenant.aliases.includes(name));
    if (owner) {
      this.removeAlias(owner.id, name);
    } else {
      this._problem.set(`${name} is not mirroring any tenant.`);
    }
  }

  removeAlias(tenantId: string, host: string): void {
    this._problem.set('');
    this.http.delete<string[]>(`${this.apiUrl}/api/tenant/${encodeURIComponent(tenantId)}/aliases/${encodeURIComponent(host)}`).subscribe({
      next: () => this.loadHosts(),
      error: (error) => this._problem.set(this.messageOf(error, 'The host was not removed.')),
    });
  }

  private loadHosts(): void {
    this.http.get<TenantHosts[]>(`${this.apiUrl}/api/tenant/hosts`).subscribe({
      next: (all) => this._all.set(all),
      error: () => this._all.set([]),
    });
  }

  private messageOf(error: unknown, fallback: string): string {
    const body = (error as { error?: unknown })?.error;
    return typeof body === 'string' && body.length > 0 ? body : fallback;
  }
}
