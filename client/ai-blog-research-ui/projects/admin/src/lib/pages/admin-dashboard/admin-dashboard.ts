import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SpinnerService } from '@adventures/core';
import { DashboardModel, DashboardService } from '../../services/dashboard.service';
import { PageHeader } from '../../components/page-header/page-header';
import { TenantPanel } from '../../components/tenant-panel/tenant-panel';
import { HealthPill } from '../../components/health-pill/health-pill';

/**
 * The admin Dashboard (the legacy BlogEngine dashboard, trimmed for the beta): the tenant being administered and its host names,
 * the post and page counts, what waits for a person (exceptions, collaboration items to review, comments to approve) and the drafts.
 */
@Component({
  selector: 'adv-admin-dashboard',
  imports: [RouterLink, MatIconModule, TenantPanel, HealthPill, PageHeader],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit, OnDestroy {
  private readonly service = inject(DashboardService);
  private readonly spinner = inject(SpinnerService);
  private spinning = false;

  protected readonly model = signal<DashboardModel | null>(null);
  protected readonly failed = signal(false);
  /** True once the dashboard has answered (or failed): only then is the health pill created, so the health check is the last thing this page starts. */
  protected readonly loaded = signal(false);

  ngOnInit(): void {
    // The gears run from the start until the health check (the slowest part) has answered.
    this.spinning = true;
    this.spinner.start();
    this.service.load().subscribe({
      next: (model) => {
        this.model.set(model);
        this.loaded.set(true);
      },
      error: () => {
        this.failed.set(true);
        this.loaded.set(true);
      },
    });
  }

  protected healthChecked(): void {
    this.stopSpinner();
  }

  ngOnDestroy(): void {
    this.stopSpinner();
  }

  private stopSpinner(): void {
    if (this.spinning) {
      this.spinning = false;
      this.spinner.stop();
    }
  }
}
