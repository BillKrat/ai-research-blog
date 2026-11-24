import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SpinnerService, describeApiError } from '@adventures/core';
import { LabelPipe } from '@adventures/entity-ui';
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
  imports: [RouterLink, MatIconModule, MatTooltipModule, LabelPipe, TenantPanel, HealthPill, PageHeader],
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

  protected readonly quickTitle = signal('');
  protected readonly quickContent = signal('');
  protected readonly quickErrors = signal<string[]>([]);
  protected readonly quickSaving = signal(false);
  /** The draft just saved, so the box can link to it. */
  protected readonly quickSaved = signal<{ id: string; title: string } | null>(null);

  protected saveQuickDraft(): void {
    this.quickSaved.set(null);
    if (this.quickTitle().trim() === '') {
      this.quickErrors.set(['Give the draft a title.']);
      return;
    }

    this.quickErrors.set([]);
    this.quickSaving.set(true);
    this.service.quickDraft(this.quickTitle(), this.quickContent()).subscribe({
      next: (draft) => {
        this.quickSaving.set(false);
        this.quickSaved.set(draft);
        this.quickTitle.set('');
        this.quickContent.set('');
        // the counts and the draft list follow
        this.service.load().subscribe({ next: (model) => this.model.set(model), error: () => undefined });
      },
      error: (error) => {
        this.quickSaving.set(false);
        this.quickErrors.set(describeApiError(error, "Couldn't save the draft."));
      },
    });
  }

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
