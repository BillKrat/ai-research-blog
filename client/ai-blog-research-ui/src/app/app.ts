import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HealthService } from './services/health.service';

type HealthState = 'checking' | 'healthy' | 'unreachable';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatButtonModule, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('AI Research Blog');
  protected readonly isDark = signal(true);
  protected readonly healthState = signal<HealthState>('checking');
  protected readonly healthCheckedAt = signal<string | null>(null);

  constructor(private readonly healthService: HealthService) {
    this.applyTheme();
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
