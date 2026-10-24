// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { SiteNav } from './components/site-nav/site-nav';
import { AdminExceptionsService } from './services/admin-exceptions.service';
import { AdminMenuService } from './services/admin-menu.service';
import { AuthService } from './services/auth.service';
import { SiteService } from './services/site.service';
import { ApiProblemService } from './services/api-problem.service';
import { HealthResponse, HealthService, describeFailures } from './services/health.service';

type HealthState = 'checking' | 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule, SiteNav],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly adminExceptions = inject(AdminExceptionsService);
  private readonly adminMenu = inject(AdminMenuService);

  private readonly site = inject(SiteService);
  protected readonly apiProblem = inject(ApiProblemService);
  private readonly documentTitle = inject(Title);

  /** The site title, from the settings an administrator edits (the default until they are read). */
  protected readonly title = computed(() => this.site.settings().title);
  protected readonly tagline = computed(() => this.site.settings().tagline);
  protected readonly isDark = signal(true);
  protected readonly healthState = signal<HealthState>('checking');
  protected readonly healthCheckedAt = signal<string | null>(null);
  /** What failed, for the status badge ("mcp (timeout)"), and the request id that finds it in the logs. */
  protected readonly healthProblem = signal<string>('');
  protected readonly healthTrace = signal<string | null>(null);
  /** A local run on the production store: a banner says so, whoever looks. */
  protected readonly liveData = signal(false);
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly username = this.authService.username;

  /** Active exceptions in the exception log; only ever above zero for an administrator (the server refuses everyone else). */
  protected readonly activeExceptionCount = this.adminExceptions.activeCount;

  /** The Admin link appears only when the server sent this caller an admin menu (administrators only). */
  protected readonly showAdminLink = this.adminMenu.hasMenu;

  constructor(private readonly healthService: HealthService) {
    effect(() => this.documentTitle.setTitle(this.title()));
    // Watch the exception count while signed in; the first refusal (not an administrator) ends the polling.
    effect(() => {
      if (this.isAuthenticated()) {
        this.adminExceptions.start();
        this.adminMenu.load();
      } else {
        this.adminExceptions.stop();
        this.adminMenu.clear();
      }
    });

    this.applyTheme();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
  }

  ngOnInit(): void {
    this.site.get().subscribe();
    // leaving the settings screen: read them again, so a title just saved shows without a browser refresh
    let lastUrl = this.router.url;
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      if (lastUrl.startsWith('/admin/settings') && !event.urlAfterRedirects.startsWith('/admin/settings')) {
        this.site.refresh();
      }
      lastUrl = event.urlAfterRedirects;
    });
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
    this.liveData.set(res.liveData === true);
  }

  toggleTheme(): void {
    this.isDark.update((dark) => !dark);
    this.applyTheme();
  }

  private applyTheme(): void {
    document.body.style.colorScheme = this.isDark() ? 'dark' : 'light';
  }
}
