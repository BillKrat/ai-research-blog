// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Injectable, Pipe, PipeTransform } from '@angular/core';

/**
 * Every piece of UI text that an icon-only button shows on hover (and announces to a screen reader) lives here, under a key,
 * and templates ask for it by key: <c>[matTooltip]="'save' | label"</c>. This is the seam for localization: a later step
 * swaps this table for a per-language one (loaded by the user's locale) and makes <see cref="LabelPipe"/> impure or
 * signal-driven so a language change repaints; no template has to change. Text that comes from the server (the names of
 * server-offered actions, field labels, messages) is the server's to localize.
 */
export const LABELS = {
  add: 'Add',
  askAgain: 'Ask again',
  askClaude: 'Ask Claude',
  asking: 'Asking Claude...',
  back: 'Back to the list',
  changePassword: 'Change password',
  changing: 'Changing...',
  copied: 'Copied',
  copyCommand: 'Copy command',
  delete: 'Delete',
  deleteAccount: 'Delete my account',
  deleting: 'Deleting...',
  insertImage: 'Insert an image (PNG, JPEG, GIF or WebP, up to 5 MB)',
  promptClaude: 'Prompt Claude',
  previewReply: 'Preview the reply as it will look',
  editReply: 'Back to editing the reply',
  draft: 'Draft',
  draftNote: 'Not published: only administrators can see this.',
  diagnose: 'Diagnose',
  diagnosing: 'Diagnosing...',
  new: 'New',
  ok: 'OK',
  open: 'Open',
  publish: 'Publish',
  purge: 'Purge',
  quickApprove: 'Start an approval: your note is sent with it when you press Send',
  quickAsk: 'Start a question',
  quickAddComment: 'Write a comment under this post',
  quickBacklog: 'Add a backlog item: a note Claude adds to the backlog; nothing else changes',
  quickChangeRequest: 'Send it back: your reply is sent with a request for changes',
  purging: 'Purging...',
  remove: 'Remove',
  revisionLocked: 'This is a proposed revision, not a post. Open it to apply or discard it; only the original is published.',
  save: 'Save',
  send: 'Send',
  unpublish: 'Unpublish',
  view: 'View on the site',
  saving: 'Saving...',
  working: 'Working...',
} as const;

export type LabelKey = keyof typeof LABELS;

@Injectable({ providedIn: 'root' })
export class UiText {
  text(key: LabelKey): string {
    return LABELS[key];
  }
}

/** <c>{{ 'save' | label }}</c>: the text for a key, from <see cref="UiText"/>. */
@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  private readonly ui = new UiText();

  transform(key: LabelKey): string {
    return this.ui.text(key);
  }
}
