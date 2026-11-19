import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DashboardModel, DashboardService } from '../../services/dashboard.service';
import { TenantPanel } from '../../components/tenant-panel/tenant-panel';
import { HealthPill } from '../../components/health-pill/health-pill';

/**
 * The admin Dashboard (the legacy BlogEngine dashboard, trimmed for the beta): the tenant being administered and its host names,
 * the post and page counts, what waits for a person (exceptions, collaboration items to review, comments to approve) and the drafts.
 */
@Component({
  selector: 'adv-admin-dashboard',
  imports: [RouterLink, MatIconModule, TenantPanel, HealthPill],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit {
  private readonly service = inject(DashboardService);

  protected readonly model = signal<DashboardModel | null>(null);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    this.service.load().subscribe({
      next: (model) => this.model.set(model),
      error: () => this.failed.set(true),
    });
  }
}
