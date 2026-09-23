import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from './services/auth.service';
import { HealthService } from './services/health.service';

type HealthState = 'checking' | 'healthy' | 'unreachable';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly title = signal('AI Research Blog');
  protected readonly isDark = signal(true);
  protected readonly healthState = signal<HealthState>('checking');
  protected readonly healthCheckedAt = signal<string | null>(null);

  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly username = this.authService.username;

  constructor(private readonly healthService: HealthService) {
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
