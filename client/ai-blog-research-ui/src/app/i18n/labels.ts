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
  diagnose: 'Diagnose',
  diagnosing: 'Diagnosing...',
  new: 'New',
  ok: 'OK',
  open: 'Open',
  purge: 'Purge',
  purging: 'Purging...',
  remove: 'Remove',
  save: 'Save',
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
