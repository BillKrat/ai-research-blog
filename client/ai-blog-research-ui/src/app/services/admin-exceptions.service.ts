import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityGridModel } from '../models/entity-form.model';

/** One kind of failure: repeats of the same exception share it (the server groups them by signature). */
export interface ExceptionSignatureSummary {
  id: string;
  exceptionType: string;
  messagePattern: string;
  topFrame: string;
  firstSeen: string | null;
  lastSeen: string | null;
  occurrenceCount: number;
  status: string;
}

/**
 * The administrator's exception log: the grid, purge, and the active count behind the header's warning icon. The count
 * is held here (a signal) so the header and the exceptions page share one value. Only administrators may call these
 * endpoints, so the first 403 switches polling off for the session instead of asking every minute to be refused.
 */
@Injectable({ providedIn: 'root' })
export class AdminExceptionsService implements OnDestroy {
  private static readonly PollMilliseconds = 60_000;

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/admin/exceptions`;
  private timer: ReturnType<typeof setInterval> | null = null;
  private notAdministrator = false;

  private readonly _activeCount = signal(0);
  readonly activeCount = this._activeCount.asReadonly();

  grid(): Observable<EntityGridModel> {
    return this.http.get<EntityGridModel>(this.baseUrl);
  }

  /** The kinds of failure seen (repeats grouped), most recently seen first. */
  signatures(): Observable<ExceptionSignatureSummary[]> {
    return this.http.get<ExceptionSignatureSummary[]>(`${this.baseUrl}/signatures`);
  }

  purge(): Observable<{ purged: number }> {
    return this.http.delete<{ purged: number }>(this.baseUrl).pipe(tap(() => this._activeCount.set(0)));
  }

  /** Starts checking the count (now, then every minute). Safe to call again. */
  start(): void {
    this.notAdministrator = false;
    this.refresh();
    if (this.timer === null) {
      this.timer = setInterval(() => this.refresh(), AdminExceptionsService.PollMilliseconds);
    }
  }

  /** Stops checking and clears the count (on sign-out). */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._activeCount.set(0);
  }

  /** Asks the server for the current count; an error or a refusal means "show nothing". */
  refresh(): void {
    if (this.notAdministrator) {
      return;
    }

    this.http.get<{ count: number }>(`${this.baseUrl}/count`).subscribe({
      next: (result) => this._activeCount.set(result.count),
      error: (error) => {
        this._activeCount.set(0);
        if (error?.status === 401 || error?.status === 403) {
          this.notAdministrator = true;
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
