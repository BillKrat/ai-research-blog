import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '../../i18n/labels';
import { EntityGrid } from '../../components/entity-grid/entity-grid';
import { describeApiError } from '../../models/api-error';
import { EntityGridModel } from '../../models/entity-form.model';
import { AdminExceptionsService, AiTriageResult, ExceptionSignatureSummary, TriageResult } from '../../services/admin-exceptions.service';

/**
 * The administrator's exception log: a grid of the active exceptions (newest first), [OK] to leave, [Purge] to retire
 * them all. Purge is a soft delete on the server like any other delete, so the history stays in the store.
 */
@Component({
  selector: 'app-admin-exceptions',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, LabelPipe, EntityGrid],
  templateUrl: './admin-exceptions.html',
  styleUrl: './admin-exceptions.scss',
})
export class AdminExceptions implements OnInit {
  private readonly service = inject(AdminExceptionsService);
  private readonly router = inject(Router);

  protected readonly model = signal<EntityGridModel | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errors = signal<string[]>([]);
  protected readonly isPurging = signal(false);
  protected readonly includePurged = signal(false);

  /** Triage answers by correlation id, and which ids are being triaged right now. */
  protected readonly triage = signal<Record<string, TriageResult>>({});
  protected readonly triaging = signal<Record<string, boolean>>({});
  protected readonly copied = signal<string | null>(null);

  /** Claude's assessments by correlation id, and which ids are waiting for one. */
  protected readonly ai = signal<Record<string, AiTriageResult>>({});
  protected readonly asking = signal<Record<string, boolean>>({});

  /** Sends a redacted report of this request to Claude and keeps the answer under the triage. */
  askClaude(correlationId: string): void {
    if (!correlationId || this.asking()[correlationId]) {
      return;
    }

    this.asking.update((state) => ({ ...state, [correlationId]: true }));
    this.service.askClaude(correlationId).subscribe({
      next: (result) => {
        this.ai.update((state) => ({ ...state, [correlationId]: result }));
        this.asking.update((state) => ({ ...state, [correlationId]: false }));
      },
      error: (error) => {
        this.asking.update((state) => ({ ...state, [correlationId]: false }));
        this.errors.set(describeApiError(error, "Couldn't ask Claude."));
      },
    });
  }

  /** Runs the read-only triage for one request and keeps the answer under its row. */
  diagnose(correlationId: string): void {
    if (!correlationId || this.triaging()[correlationId]) {
      return;
    }

    this.triaging.update((state) => ({ ...state, [correlationId]: true }));
    this.service.triage(correlationId).subscribe({
      next: (result) => {
        this.triage.update((state) => ({ ...state, [correlationId]: result }));
        this.triaging.update((state) => ({ ...state, [correlationId]: false }));
      },
      error: (error) => {
        this.triaging.update((state) => ({ ...state, [correlationId]: false }));
        this.errors.set(describeApiError(error, "Couldn't run the diagnosis."));
      },
    });
  }

  /** Copies the command that hands this request to Claude (the console of whoever runs it needs the vault, not this page). */
  async copyHandOff(result: TriageResult): Promise<void> {
    try {
      await navigator.clipboard.writeText(result.handOffCommand);
      this.copied.set(result.correlationId);
    } catch {
      this.copied.set(null);
    }
  }
  protected readonly signatures = signal<ExceptionSignatureSummary[]>([]);
  protected readonly statusChoices = ['New', 'Acknowledged', 'Fixed'];

  /** Saves the status an administrator picked for a kind of failure, then shows what the server now holds. */
  setStatus(kind: ExceptionSignatureSummary, status: string): void {
    this.service.setSignatureStatus(kind.id, status).subscribe({
      next: () => this.signatures.update((kinds) => kinds.map((k) => (k.id === kind.id ? { ...k, status } : k))),
      error: (error) => this.errors.set(describeApiError(error, "Couldn't change the status.")),
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ok(): void {
    this.router.navigateByUrl('/');
  }

  purge(): void {
    if (this.isPurging() || !window.confirm('Purge all exceptions? They are hidden from this list but stay in the store.')) {
      return;
    }

    this.isPurging.set(true);
    this.service.purge().subscribe({
      next: () => {
        this.isPurging.set(false);
        this.load();
      },
      error: (error) => {
        this.isPurging.set(false);
        this.errors.set(describeApiError(error, "Couldn't purge the exceptions. Try again."));
      },
    });
  }

  /** Shows or hides the purged entries (a purge is a soft delete, so they are still in the store). */
  togglePurged(show: boolean): void {
    this.includePurged.set(show);
    this.load();
  }

  private load(): void {
    this.errors.set([]);
    this.service.grid(this.includePurged()).subscribe({
      next: (grid) => {
        this.model.set(grid);
        this.isLoading.set(false);
        this.service.refresh();
      },
      // (signatures load separately below so a failure there never hides the grid)
      error: (error) => {
        this.isLoading.set(false);
        this.errors.set(describeApiError(error, "Couldn't load the exceptions."));
      },
    });

    this.service.signatures().subscribe({
      next: (signatures) => this.signatures.set(signatures),
      error: (error) => this.errors.update((messages) => [...messages, ...describeApiError(error, "Couldn't load the exception kinds.")]),
    });
  }
}
