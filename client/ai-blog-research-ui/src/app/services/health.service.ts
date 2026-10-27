// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

/** One thing the API depends on: ok or failed, how long the check took, and a short non-sensitive code. */
export interface DependencyHealth {
  name: string;
  status: string;
  durationMs: number;
  detail: string | null;
}

export interface HealthResponse {
  /** Healthy, Degraded (a dependency such as mcp failed) or Unhealthy (the database failed; the server answers 503). */
  status: string;
  timestampUtc: string;
  dependencies?: DependencyHealth[] | null;
  /** True when this API is a local run on the live store (LiveData mode, Development only). */
  liveData?: boolean;
  correlationId?: string | null;
}

/** The failed dependencies of a response as one readable line, e.g. "mcp (timeout)". Empty when none failed. */
export function describeFailures(health: Pick<HealthResponse, 'dependencies'>): string {
  return (health.dependencies ?? [])
    .filter((d) => d.status !== 'ok')
    .map((d) => (d.detail ? `${d.name} (${d.detail})` : d.name))
    .join(', ');
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  /**
   * The anonymous answer is only status and time. A signed-in person asks for the detail first (dependencies, trace id); a person
   * without the diagnostics right gets 401/403 there and falls back to the public answer. A 503 is an answer, so it is passed on.
   */
  check(signedIn: boolean): Observable<HealthResponse> {
    const publicHealth = this.http.get<HealthResponse>(`${environment.apiUrl}/api/health`);
    if (!signedIn) {
      return publicHealth;
    }

    return this.http.get<HealthResponse>(`${environment.apiUrl}/api/health/detail`).pipe(
      catchError((error) => (error?.status === 401 || error?.status === 403 ? publicHealth : throwError(() => error))),
    );
  }
}
