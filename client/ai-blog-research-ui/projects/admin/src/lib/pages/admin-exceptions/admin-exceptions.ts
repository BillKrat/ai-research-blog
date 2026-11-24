// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EntityGrid, GridRequest, LabelPipe } from '@adventures/entity-ui';
import { describeApiError, EntityDataModel, EntityGridModel, PageBannerService, SpinnerService, bindSpinner } from '@adventures/core';
import { PageHeader } from '../../components/page-header/page-header';
import { AdminExceptionsService, AiTriageResult, ExceptionSignatureSummary, TriageResult } from '@adventures/core';

/**
 * The administrator's exception log: a grid of the active exceptions (newest first), [OK] to leave, [Purge] to retire
 * them all. Purge is a soft delete on the server like any other delete, so the history stays in the store.
 */
@Component({
  selector: 'adv-admin-exceptions',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, LabelPipe, EntityGrid, PageHeader],
  templateUrl: './admin-exceptions.html',
  styleUrl: './admin-exceptions.scss',
})
export class AdminExceptions implements OnInit, OnDestroy {
  private readonly service = inject(AdminExceptionsService);
  private readonly router = inject(Router);
  private readonly spinner = inject(SpinnerService);
  private readonly banner = inject(PageBannerService);

  protected readonly model = signal<EntityGridModel | null>(null);
  protected readonly isLoading = signal(true);
  private readonly gears = bindSpinner(this.isLoading);
  protected readonly errors = signal<string[]>([]);
  protected readonly isPurging = signal(false);
  protected readonly includePurged = signal(false);
  /** The page of the list being shown (1 based); anything that changes which rows are listed starts again at 1. */
  private readonly page = signal(1);

  /** The kind of failure whose occurrences are shown (a drill-down), or null for every occurrence. */
  protected readonly drilled = signal<ExceptionSignatureSummary | null>(null);

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

  /** The prompt text of each row (by entity id) once an administrator has edited it, and which row was last copied. */
  protected readonly promptEdits = signal<Record<string, string>>({});
  protected readonly promptCopied = signal<string | null>(null);

  /**
   * "Prompt Claude": a ready-to-paste request for a Claude Code session, built from the row on screen. It works for every row,
   * including the ones with no correlation id (a failure at startup happens before any request, so Diagnose and Ask Claude have
   * nothing to look up). Nothing is sent from here: the text is the administrator's to edit and paste. It names the ids and the
   * message, not the stack trace; Claude reads the evidence itself through the MCP diagnostics tools (get_exception, diagnose_request), or the vault script when MCP is not set up.
   */
  promptFor(row: EntityDataModel): string {
    const edited = this.promptEdits()[row.entityId];
    if (edited !== undefined) {
      return edited;
    }

    const pick = (...names: string[]): string => {
      const wanted = names.map((n) => n.toLowerCase());
      const key = Object.keys(row.values).find((k) => wanted.includes(k.toLowerCase()));
      return (key ? row.values[key] : null) ?? '';
    };
    const message = pick('Message').replace(/\s+/g, ' ').slice(0, 600);
    const correlationId = pick('CorrelationId');
    const lines = [
      'Claude: please triage this exception from the AI Research Blog and tell me the cause and the fix.',
      '',
      `- Type: ${pick('ExceptionType') || 'unknown'}`,
      `- Message: ${message || 'none recorded'}`,
      `- Occurred at: ${pick('OccurredAt', 'Occurred at') || 'unknown'}`,
      `- Request: ${pick('Request') || 'none'}`,
      `- Signature id: ${pick('SignatureId') || 'none'}`,
      `- Correlation id: ${correlationId || 'none (recorded outside a request, for example at startup)'}`,
      `- Exception entry id: ${row.entityId}`,
      '',
      'Read the evidence yourself rather than trusting this summary. Use the MCP server "adventures-diagnostics" (read-only, registered in the workspace .mcp.json):',
      '',
      `1. Call get_exception with id "${row.entityId}" (when, type, message, request, user, correlation id and the kind of failure).`,
      correlationId
        ? `2. Call diagnose_request with correlationId "${correlationId}" (the exceptions, kinds and log lines of that request).`
        : '2. There is no correlation id, so call exception_signatures and recent_exceptions and match this one by its signature id and time.',
      '',
      'If the MCP server is not available in this session, run this from the workspace root instead:',
      '',
      correlationId
        ? `.\\docs\\Claude-secret.ps1 run m2m/claude-diagnostics/claude-diagnostics -EnvVar CLAUDE_DIAG_SECRET -Exec powershell -ExecArgs "-NoProfile","-File",".\\docs\\Claude-diagnose.ps1","-CorrelationId","${correlationId}"`
        : '.\\docs\\Claude-secret.ps1 run m2m/claude-diagnostics/claude-diagnostics -EnvVar CLAUDE_DIAG_SECRET -Exec powershell -ExecArgs "-NoProfile","-File",".\\docs\\Claude-diagnose.ps1"   (lists the kinds of failure and the most recent exceptions; match this one by its signature id and time)',
      '',
      'If this is a local run, also read the newest src/AiBlogResearch.WebApi/bin/Debug/net10.0/logs/startup-*.log. Then propose the smallest fix on a branch.',
    ];
    return lines.join('\n');
  }

  editPrompt(row: EntityDataModel, text: string): void {
    this.promptEdits.update((state) => ({ ...state, [row.entityId]: text }));
  }

  async copyPrompt(row: EntityDataModel): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.promptFor(row));
      this.promptCopied.set(row.entityId);
    } catch {
      this.promptCopied.set(null);
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

  ngOnDestroy(): void {
    this.banner.clear();
  }

  /** The standard banner under the site menu says which kind is being shown (and how many), with Show all beside it. */
  private updateBanner(count: number): void {
    const kind = this.drilled();
    if (!kind) {
      this.banner.clear();
      return;
    }

    this.banner.show({
      text: `Showing the ${count} occurrences of ${kind.exceptionType}: ${kind.messagePattern}`,
      actionLabel: 'Show all',
      action: () => this.showAll(),
    });
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

  /**
   * Shows only the occurrences of one kind of failure, and leaves the page where it is (the reader scrolls up to the banner). A kind's occurrences may all have been purged,
   * so "show history" is switched on with the click (otherwise the list came back empty and the click seemed to do nothing).
   */
  drill(kind: ExceptionSignatureSummary): void {
    this.drilled.set(kind);
    this.includePurged.set(true);
    this.page.set(1);
    this.load(true);
  }

  /** Leaves the drill-down: every occurrence again. */
  showAll(): void {
    this.drilled.set(null);
    this.page.set(1);
    this.load();
  }

  /** Shows or hides the purged entries (a purge is a soft delete, so they are still in the store). */
  togglePurged(show: boolean): void {
    this.includePurged.set(show);
    this.page.set(1);
    this.load();
  }

  /** Next and previous page of the list (the server pages it, 25 a time); the drill-down and history switch are kept. */
  protected onRequest(request: GridRequest): void {
    if (request.kind === 'next' || request.kind === 'previous') {
      this.page.update((p) => Math.max(1, p + (request.kind === 'next' ? 1 : -1)));
      this.load(true);
    }
  }

  private load(withSpinner = false): void {
    this.errors.set([]);
    if (withSpinner) {
      this.spinner.start();
    }

    this.service.grid(this.includePurged(), this.drilled()?.id, this.page()).subscribe({
      next: (grid) => {
        this.page.set(grid.paging?.page ?? 1);
        if (withSpinner) {
          this.spinner.stop();
        }

        this.model.set(grid);
        this.updateBanner(grid.paging?.totalCount ?? grid.rows.length);
        this.isLoading.set(false);
        this.service.refresh();
      },
      // (signatures load separately below so a failure there never hides the grid)
      error: (error) => {
        if (withSpinner) {
          this.spinner.stop();
        }

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
