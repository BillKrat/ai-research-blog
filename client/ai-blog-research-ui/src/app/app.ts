import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { AdminExceptionsService } from './services/admin-exceptions.service';
import { AuthService } from './services/auth.service';
import { HealthResponse, HealthService, describeFailures } from './services/health.service';

type HealthState = 'checking' | 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly adminExceptions = inject(AdminExceptionsService);

  protected readonly title = signal('AI Research Blog');
  protected readonly isDark = signal(true);
  protected readonly healthState = signal<HealthState>('checking');
  protected readonly healthCheckedAt = signal<string | null>(null);
  /** What failed, for the status badge ("mcp (timeout)"), and the request id that finds it in the logs. */
  protected readonly healthProblem = signal<string>('');
  protected readonly healthTrace = signal<string | null>(null);
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly username = this.authService.username;

  /** Active exceptions in the exception log; only ever above zero for an administrator (the server refuses everyone else). */
  protected readonly activeExceptionCount = this.adminExceptions.activeCount;

  constructor(private readonly healthService: HealthService) {
    // Watch the exception count while signed in; the first refusal (not an administrator) ends the polling.
    effect(() => {
      if (this.isAuthenticated()) {
        this.adminExceptions.start();
      } else {
        this.adminExceptions.stop();
      }
    });

    this.applyTheme();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
  }

  ngOnInit(): void {
    this.checkHealth();
    // A dependency can fail (or recover) while the page is open, so look again every two minutes.
    this.healthTimer = setInterval(() => this.checkHealth(), 120_000);
  }

  ngOnDestroy(): void {
    if (this.healthTimer !== null) {
      clearInterval(this.healthTimer);
    }
  }

  private checkHealth(): void {
    this.healthService.check().subscribe({
      next: (res) => this.showHealth(res),
      // A 503 (database failed) carries the same body as a 200: show what it says instead of a bare "unreachable".
      error: (error) => {
        if (error?.status === 503 && error.error?.status) {
          this.showHealth(error.error as HealthResponse);
        } else {
          this.healthState.set('unreachable');
          this.healthProblem.set('');
          this.healthTrace.set(null);
        }
      },
    });
  }

  private showHealth(res: HealthResponse): void {
    const status = res.status?.toLowerCase();
    this.healthState.set(status === 'unhealthy' ? 'unhealthy' : status === 'degraded' ? 'degraded' : 'healthy');
    this.healthCheckedAt.set(new Date(res.timestampUtc).toLocaleTimeString());
    this.healthProblem.set(describeFailures(res));
    this.healthTrace.set(res.correlationId ?? null);
  }

  toggleTheme(): void {
    this.isDark.update((dark) => !dark);
    this.applyTheme();
  }

  private applyTheme(): void {
    document.body.style.colorScheme = this.isDark() ? 'dark' : 'light';
  }
}
