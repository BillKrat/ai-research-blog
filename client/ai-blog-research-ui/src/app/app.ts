// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { SiteNav, SiteService } from '@adventures/blog-reader';
import { AdminExceptionsService, AdminMenuService, HealthService } from '@adventures/admin';
import { API_BASE_URL, ApiProblemService, AuthService, SpinnerService } from '@adventures/core';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule, SiteNav],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly adminExceptions = inject(AdminExceptionsService);
  private readonly adminMenu = inject(AdminMenuService);

  private readonly site = inject(SiteService);
  protected readonly apiProblem = inject(ApiProblemService);
  /** The turning gears shown over the page while any screen has asked for them. */
  protected readonly spinner = inject(SpinnerService);
  /** The RSS feed lives on the API (the site is static files); its links point at this site, decided server-side from the tenant. */
  protected readonly feedUrl = `${inject(API_BASE_URL)}/api/public/feed`;
  private readonly documentTitle = inject(Title);

  /** The site title, from the settings an administrator edits (the default until they are read). */
  protected readonly title = computed(() => this.site.settings().title);
  protected readonly tagline = computed(() => this.site.settings().tagline);
  protected readonly isDark = signal(true);
  /** True under /admin: the admin area uses the whole window (menu at the left edge); the public site keeps its reading width. */
  protected readonly wide = signal(false);
  protected readonly liveData = signal(false);

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
    this.wide.set(lastUrl.startsWith('/admin'));
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.wide.set(event.urlAfterRedirects.startsWith('/admin'));
      if (lastUrl.startsWith('/admin/settings') && !event.urlAfterRedirects.startsWith('/admin/settings')) {
        this.site.refresh();
      }
      lastUrl = event.urlAfterRedirects;
    });
    // one cheap question for the LIVE DATA banner; the health check itself is on the Dashboard
    this.healthService.runtime().subscribe({ next: (info) => this.liveData.set(info.liveData === true), error: () => this.liveData.set(false) });
  }


  toggleTheme(): void {
    this.isDark.update((dark) => !dark);
    this.applyTheme();
  }

  private applyTheme(): void {
    document.body.style.colorScheme = this.isDark() ? 'dark' : 'light';
  }
}
