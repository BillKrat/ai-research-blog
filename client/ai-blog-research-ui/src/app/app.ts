import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { AdminExceptionsService } from './services/admin-exceptions.service';
import { AuthService } from './services/auth.service';
import { HealthService } from './services/health.service';

type HealthState = 'checking' | 'healthy' | 'unreachable';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly adminExceptions = inject(AdminExceptionsService);

  protected readonly title = signal('AI Research Blog');
  protected readonly isDark = signal(true);
  protected readonly healthState = signal<HealthState>('checking');
  protected readonly healthCheckedAt = signal<string | null>(null);

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
    this.healthService.check().subscribe({
      next: (res) => {
        this.healthState.set('healthy');
        this.healthCheckedAt.set(new Date(res.timestampUtc).toLocaleTimeString());
      },
      error: () => this.healthState.set('unreachable'),
    });
  }

  toggleTheme(): void {
    this.isDark.update((dark) => !dark);
    this.applyTheme();
  }

  private applyTheme(): void {
    document.body.style.colorScheme = this.isDark() ? 'dark' : 'light';
  }
}
