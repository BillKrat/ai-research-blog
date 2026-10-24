// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityGridModel } from '../models/entity-form.model';

export interface TriageFinding {
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'problem' | string;
}

/** The Diagnose answer for one request: a verdict, the findings behind it, what to do next, and the command that hands it to Claude. */
export interface TriageResult {
  correlationId: string;
  verdict: string;
  summary: string;
  findings: TriageFinding[];
  nextSteps: string[];
  handOffCommand: string;
}

/** Claude's assessment of one request, or why there is none (not set up, limit reached, unreachable). */
export interface AiTriageResult {
  available: boolean;
  reason: string | null;
  model: string | null;
  summary: string | null;
  likelyCause: string | null;
  confidence: string | null;
  nextSteps: string[];
  missingEvidence: string[];
  inputTokens: number;
  outputTokens: number;
  sentCharacters: number;
  fromCache: boolean;
}

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

  private readonly _totalCount = signal(0);
  /** All exceptions ever recorded, purged ones included: while this is above zero there is history worth opening. */
  readonly totalCount = this._totalCount.asReadonly();

  private readonly _isAdministrator = signal(false);
  /** True once the server has answered the count for this user (only administrators get an answer). */
  readonly isAdministrator = this._isAdministrator.asReadonly();

  /** The exceptions (newest first); with includePurged the purged ones too, each marked in its State column. */
  grid(includePurged = false): Observable<EntityGridModel> {
    return this.http.get<EntityGridModel>(this.baseUrl, { params: includePurged ? { includePurged: 'true' } : {} });
  }

  /** The kinds of failure seen (repeats grouped), most recently seen first. */
  signatures(): Observable<ExceptionSignatureSummary[]> {
    return this.http.get<ExceptionSignatureSummary[]>(`${this.baseUrl}/signatures`);
  }

  /** Runs the server's triage of one request (read-only); the id is the CorrelationId shown in the grid. */
  triage(correlationId: string): Observable<TriageResult> {
    return this.http.get<TriageResult>(`${environment.apiUrl}/api/admin/diagnostics/${encodeURIComponent(correlationId)}/triage`);
  }

  /** Asks Claude to assess one request. Sends a redacted report to Anthropic and costs money, so it only runs from a click. */
  askClaude(correlationId: string): Observable<AiTriageResult> {
    return this.http.post<AiTriageResult>(
      `${environment.apiUrl}/api/admin/diagnostics/${encodeURIComponent(correlationId)}/ai-triage`,
      {},
    );
  }

  /** Sets the triage status of one kind of failure (Acknowledged, Fixed, or back to New). */
  setSignatureStatus(signatureId: string, status: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/signatures/${encodeURIComponent(signatureId)}/status`, { status });
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
    this._totalCount.set(0);
    this._isAdministrator.set(false);
  }

  /** Asks the server for the current count; an error or a refusal means "show nothing". */
  refresh(): void {
    if (this.notAdministrator) {
      return;
    }

    this.http.get<{ count: number; total?: number }>(`${this.baseUrl}/count`).subscribe({
      next: (result) => {
        this._activeCount.set(result.count);
        this._totalCount.set(result.total ?? result.count);
        this._isAdministrator.set(true);
      },
      error: (error) => {
        this._activeCount.set(0);
        if (error?.status === 401 || error?.status === 403) {
          this.notAdministrator = true;
          this._isAdministrator.set(false);
          this._totalCount.set(0);
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
