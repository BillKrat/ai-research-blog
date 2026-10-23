import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

  check(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${environment.apiUrl}/api/health`);
  }
}
