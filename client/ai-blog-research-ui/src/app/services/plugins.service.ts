// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** A built-in plug-in and whether it is on. */
export interface PluginState {
  key: string;
  title: string;
  description: string;
  version: string;
  priority: number;
  enabled: boolean;
}

/** The Plugins page's API: list the built-in plug-ins, switch one on or off (administrators only). */
@Injectable({ providedIn: 'root' })
export class PluginsService {
  private readonly http = inject(HttpClient);

  list(): Observable<PluginState[]> {
    return this.http.get<PluginState[]>(`${environment.apiUrl}/api/plugins`);
  }

  setEnabled(key: string, enabled: boolean): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/api/plugins/${encodeURIComponent(key)}/${enabled ? 'enable' : 'disable'}`, {});
  }
}
