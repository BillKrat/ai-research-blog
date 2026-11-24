import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { describeApiError } from '@adventures/core';
import { LabelPipe } from '@adventures/entity-ui';
import { PageHeader } from '../../components/page-header/page-header';
import { MaintenanceAdminService } from '../../services/maintenance-admin.service';

/** Maintenance: a downloadable JSON backup of posts and pages, and clearing what the server remembers about hosts and sites. */
@Component({
  selector: 'adv-admin-maintenance',
  imports: [PageHeader, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './admin-maintenance.html',
  styleUrl: './admin-maintenance.scss',
})
export class AdminMaintenance {
  private readonly api = inject(MaintenanceAdminService);

  protected readonly status = signal('');
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);

  protected exportContent(): void {
    this.begin();
    this.api.exportContent().subscribe({
      next: (file) => {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = `content-export-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.finish('The backup was downloaded. Keep it somewhere safe: it holds your drafts too.');
      },
      error: (error) => this.fail(error, "Couldn't make the backup."),
    });
  }

  protected clearCache(): void {
    this.begin();
    this.api.clearCache().subscribe({
      next: () => this.finish('The cache was cleared.'),
      error: (error) => this.fail(error, "Couldn't clear the cache."),
    });
  }

  private begin(): void {
    this.status.set('');
    this.errors.set([]);
    this.busy.set(true);
  }

  private finish(message: string): void {
    this.busy.set(false);
    this.status.set(message);
  }

  private fail(error: unknown, fallback: string): void {
    this.busy.set(false);
    this.errors.set(describeApiError(error, fallback));
  }
}
