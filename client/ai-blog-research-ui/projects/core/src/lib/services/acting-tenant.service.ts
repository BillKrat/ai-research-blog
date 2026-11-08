import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'adventures.actingTenant';

/**
 * Which tenant the signed-in person has chosen to work in (the tenant switcher), kept in this browser only. It is a request, not a right: every call
 * carries it in the X-Acting-Tenant header and the server decides whether this person may act there (and refuses with 403 when not). Nothing is
 * stored when the browser blocks storage; the choice then lasts until the page is reloaded.
 */
@Injectable({ providedIn: 'root' })
export class ActingTenantService {
  private readonly _id = signal<string | null>(ActingTenantService.read());
  readonly id = this._id.asReadonly();

  /** Chooses the tenant to work in; null goes back to the tenant the address names. */
  choose(id: string | null): void {
    this._id.set(id);
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // storage can be blocked (private window, site data cleared): the choice then lasts for this page only
    }
  }

  /** Loads the page again so every screen asks for what the chosen tenant holds. */
  reload(): void {
    window.location.reload();
  }

  private static read(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
