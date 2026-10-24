// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Component } from '@angular/core';
import { LabelPipe } from '../../i18n/labels';

/**
 * The mark an administrator sees on a post or page that is not published. The server only sends drafts to a signed-in administrator
 * (the reader asks with the same token as the admin), so this badge never appears for a visitor.
 */
@Component({
  selector: 'app-draft-badge',
  imports: [LabelPipe],
  template: `<span class="draft-badge" [attr.title]="'draftNote' | label">{{ 'draft' | label }}</span>`,
  styleUrl: './draft-badge.scss',
})
export class DraftBadge {}
