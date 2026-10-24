// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component, computed, input } from '@angular/core';

/**
 * The review state of a collaboration post (Needs review, Approved, Changes requested), as the server names it. The server sends it
 * only in an administrator's view, so a visitor never sees this badge. The colour follows the state; the text is always there, so the
 * state never depends on colour alone.
 */
@Component({
  selector: 'app-approval-badge',
  template: `<span class="approval-badge" [class]="'approval-badge approval-badge--' + tone()">{{ status() }}</span>`,
  styleUrl: './approval-badge.scss',
})
export class ApprovalBadge {
  readonly status = input.required<string>();

  protected readonly tone = computed(() => (this.status() === 'Approved' ? 'approved' : this.status() === 'Changes requested' ? 'changes' : 'review'));
}
