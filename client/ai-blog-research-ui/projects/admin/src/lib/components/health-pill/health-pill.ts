import { Component, OnDestroy, OnInit, computed, inject, output, signal } from '@angular/core';
import { ApiProblemService } from '@adventures/core';
import { HealthResponse, HealthService, describeFailures } from '@adventures/core';

type HealthState = 'checking' | 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';

/**
 * The API health pill. It lives on the Dashboard, so the check (which probes the database and the MCP server and can take seconds) runs only
 * while an administrator is looking at it, never while the menu and the page are loading. It looks again every two minutes, and shows
 * "unreachable" at once when any call to the API has just gone unanswered.
 */
@Component({
  selector: 'adv-health-pill',
  templateUrl: './health-pill.html',
  styleUrl: './health-pill.scss',
})
export class HealthPill implements OnInit, OnDestroy {
  private readonly health = inject(HealthService);
  private readonly apiProblem = inject(ApiProblemService);
  private timer: ReturnType<typeof setInterval> | null = null;
  private announced = false;

  /** Emitted once, when the first check has answered (well or badly), so a page can stop its spinner. */
  readonly checked = output<void>();

  private readonly measured = signal<HealthState>('checking');
  protected readonly state = computed<HealthState>(() => (this.apiProblem.unreachable() ? 'unreachable' : this.measured()));
  protected readonly checkedAt = signal<string | null>(null);
  protected readonly problem = signal('');
  protected readonly trace = signal<string | null>(null);

  ngOnInit(): void {
    this.check();
    this.timer = setInterval(() => this.check(), 120_000);
  }

  ngOnDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private check(): void {
    this.health.check(true).subscribe({
      next: (res) => {
        this.show(res);
        this.announce();
      },
      // A 503 (database failed) carries the same body as a 200: show what it says instead of a bare "unreachable".
      error: (error) => {
        if (error?.status === 503 && error.error?.status) {
          this.show(error.error as HealthResponse);
        } else {
          this.measured.set('unreachable');
          this.problem.set('');
          this.trace.set(null);
        }

        this.announce();
      },
    });
  }

  private announce(): void {
    if (!this.announced) {
      this.announced = true;
      this.checked.emit();
    }
  }

  private show(res: HealthResponse): void {
    const status = res.status?.toLowerCase();
    this.measured.set(status === 'unhealthy' ? 'unhealthy' : status === 'degraded' ? 'degraded' : 'healthy');
    this.checkedAt.set(new Date(res.timestampUtc).toLocaleTimeString());
    this.problem.set(describeFailures(res));
    this.trace.set(res.correlationId ?? null);
  }
}
