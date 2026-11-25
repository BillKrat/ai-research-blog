// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { Injectable, Pipe, PipeTransform, inject, signal } from '@angular/core';

/**
 * Every piece of UI text that an icon-only button shows on hover (and announces to a screen reader) lives here, under a key,
 * and templates ask for it by key: <c>[matTooltip]="'save' | label"</c>. This is the seam for localization: a later step
 * swaps this table for a per-language one (loaded by the user's locale) and makes <see cref="LabelPipe"/> impure or
 * signal-driven so a language change repaints; no template has to change (done: <see cref="LabelService"/> holds the table). Text that comes from the server (the names of
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
  quickAddComment: 'Add the comment you wrote under this post (or start one)',
  quickBacklog: 'Add a backlog item: a note Claude adds to the backlog; nothing else changes',
  quickChangeRequest: 'Send it back: your reply is sent with a request for changes',
  purging: 'Purging...',
  remove: 'Remove',
  removeNamed: 'Remove {0}',
  revisionLocked: 'This is a proposed revision, not a post. Open it to apply or discard it; only the original is published.',
  allSettings: 'All settings (plain list)',
  sendMessage: 'Send message',
  save: 'Save',
  send: 'Send',
  unpublish: 'Unpublish',
  view: 'View on the site',
  popOutSteps: 'Open the test steps in their own window',
  saving: 'Saving...',
  working: 'Working...',
  dismiss: 'Dismiss',
  switchToLight: 'Switch to light mode',
  switchToDark: 'Switch to dark mode',
  colourTheme: 'Colour theme',
  accountMenu: 'Account menu',
  logOut: 'Log out',
  signIn: 'Sign in',
  newer: 'Newer',
  older: 'Older',
  sendComment: 'Send comment',
  addNoun: 'Add a {0}',
  editNoun: 'Edit this {0}',
  deleteNoun: 'Delete this {0}',
  clear: 'Clear',
  apply: 'Apply',
  saveRights: 'Save rights',
  addHostNameTo: 'Add host name to {0}',
  confirmDeleteOf: 'Confirm delete of {0}',
  cancelDeleteOf: 'Cancel delete of {0}',
  deleteNamed: 'Delete {0}',
  deleteTenant: 'Delete tenant',
  cancel: 'Cancel',
  deleteStart: 'Delete…',
  approve: 'Approve',
  unapprove: 'Unapprove',
  expandMenu: 'Expand menu',
  collapseMenu: 'Collapse menu',
  copy: 'Copy',
  done: 'Done',
  moveUpNamed: 'Move up {0}',
  moveDownNamed: 'Move down {0}',
  editNamed: 'Edit {0}',
  addWidget: 'Add',
  saveSettings: 'Save',
  edit: 'Edit',
  customize: 'Customize',
  logOff: 'Log off',
  profile: 'Profile',
  viewMyBlog: 'View my blog',
  previous: 'Previous',
  next: 'Next',
  chooseColumns: 'Choose columns',
  columns: 'Columns',
  sortBy: 'Sort by {0}',
  editorMode: 'Editor',
  markdownMode: 'Markdown',
  showOccurrences: 'Show the {0} occurrences of {1}',
  bold: 'Bold',
  italic: 'Italic',
  strikethrough: 'Strikethrough',
  inlineCode: 'Inline code',
  heading: 'Heading',
  subHeading: 'Sub-heading',
  bulletedList: 'Bulleted list',
  numberedList: 'Numbered list',
  quote: 'Quote',
  codeBlock: 'Code block (also for a Mermaid diagram)',
  codeBlockName: 'Code block',
  dividerLine: 'Divider line',
  link: 'Link',
  picture: 'Picture',
  cancelChangeRequest: 'Cancel change request',
  changeRequest: 'Change request',
  addComment: 'Add comment',
  ask: 'Ask',
  backlog: 'Backlog',
  loadEnglish: 'Load the English texts',
  reviewProposal: 'Review the proposal for {0}',
  discardProposal: 'Discard the proposal',
  sendTest: 'Send a test message',
  forgotPassword: 'Forgot my password',
  sendResetLink: 'Send me a reset link',
  setNewPassword: 'Set the new password',
  sendVerification: 'Send a verification mail',
  sendVerificationToPerson: 'Send the confirmation mail to this person',
  sendingVerification: 'Sending...',
  exportContent: 'Download a backup of posts and pages',
  clearCache: 'Clear the cache',
  search: 'Search',
  createTenant: 'Create tenant',
  setupTitle: 'Set up this address',
  setupChecking: 'Checking this address...',
  setupNotNeeded: 'This address needs no setup.',
  setupIntro: '{0} is not attached to a site yet. Sign in as a platform administrator of one of your sites to attach it, or to start a new site here.',
  setupSite: 'Your site (its domain)',
  setupUserName: 'Your user name on that site',
  setupPassword: 'Your password on that site',
  setupBadSignIn: 'That did not work. Check the site, the user name and the password; only a platform administrator can set up an address.',
  setupChangePasswordFirst: 'Sign in to that site and change the default password first.',
  setupFailed: 'The setup did not complete. Try again.',
  setupChoose: 'Signed in. What should {0} be?',
  setupAttachTo: 'Attach it to this site',
  setupAttach: 'Attach to site',
  setupNewNote: 'Or start a new, separate site here. It gets its own Admin with the default password, which must be changed at the first sign-in.',
  setupSiteName: 'Name of the new site',
  setupNew: 'Start a new site',
  setupAttached: 'Done. This address now shows that site.',
  setupCreated: 'Done. A new site is ready here: sign in with Admin and Admin, then choose a new password.',
  setupOpenSite: 'Open the site',
} as const;

export type LabelKey = keyof typeof LABELS;

/**
 * The language table in use: English from <see cref="LABELS"/>, overridden key by key by the table an administrator's language
 * file supplies (<see cref="load"/>). A missing, empty or non-text value falls back to English, so a bad file can never blank a button.
 * <c>{0}</c> and <c>{1}</c> in a text are replaced by the arguments (a name inside a translated sentence).
 */
@Injectable({ providedIn: 'root' })
export class LabelService {
  readonly language = signal('en');
  private readonly table = signal<Readonly<Record<string, string>>>({});

  load(language: string, table: Readonly<Record<string, string>>): void {
    this.language.set(language);
    this.table.set(table ?? {});
  }

  text(key: LabelKey, ...args: readonly (string | number)[]): string {
    const own = this.table()[key];
    const template = typeof own === 'string' && own.trim().length > 0 ? own : LABELS[key];
    return template.replace(/\{(\d+)\}/g, (match, index: string) => String(args[Number(index)] ?? match));
  }
}

/** <c>{{ 'save' | label }}</c> or <c>{{ 'removeNamed' | label: name }}</c>: the text for a key in the current language; not memoised, so a language switch repaints. */
@Pipe({ name: 'label', pure: false })
export class LabelPipe implements PipeTransform {
  private readonly labels = inject(LabelService);

  transform(key: LabelKey, ...args: (string | number)[]): string {
    return this.labels.text(key, ...args);
  }
}
