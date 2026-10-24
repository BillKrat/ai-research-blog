// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';

/** One menu entry as the server sends it: a screen that is not built yet has available false and no route. */
export interface AdminMenuItem {
  id: string;
  label: string;
  route: string | null;
  icon: string | null;
  available: boolean;
  badge: number | null;
}

export interface AdminMenuSection {
  id: string;
  label: string;
  items: AdminMenuItem[];
}

export interface AdminMenuModel {
  sections: AdminMenuSection[];
  contractVersion?: number;
}

/**
 * The admin navigation, from the server: the sections and items this caller may see, in order. The client holds no list of
 * admin screens and no role checks; an empty menu means the caller is not an administrator, and the header then offers no
 * admin link at all.
 */
@Injectable({ providedIn: 'root' })
export class AdminMenuService {
  private readonly http = inject(HttpClient);

  private readonly _menu = signal<AdminMenuModel>({ sections: [] });
  readonly menu = this._menu.asReadonly();

  /** True when the server sent at least one item (only administrators get any). */
  readonly hasMenu = computed(() => this._menu().sections.length > 0);

  load(): void {
    this.http.get<AdminMenuModel>(`${environment.apiUrl}/api/admin/menu`).subscribe({
      next: (menu) => this._menu.set(menu),
      error: () => this._menu.set({ sections: [] }),
    });
  }

  clear(): void {
    this._menu.set({ sections: [] });
  }
}
