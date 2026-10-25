import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';

/** The tenant this visit is for, as the server worked it out from the domain: Domain (a real match), Fallback (a development stand-in) or None. */
export interface CurrentTenant {
  host: string;
  tenant: { id: string; name: string | null; domain: string | null } | null;
  match: 'Domain' | 'Fallback' | 'None';
}

/** Which tenant the domain names. Display only: the client decides nothing from it. */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);

  private readonly _current = signal<CurrentTenant | null>(null);
  readonly current = this._current.asReadonly();

  load(): void {
    this.http.get<CurrentTenant>(`${environment.apiUrl}/api/tenant/current`).subscribe({
      next: (current) => this._current.set(current),
      error: () => this._current.set(null),
    });
  }
}
