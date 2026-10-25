// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { DatePipe } from '@angular/common';
import { Component, ElementRef, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '../../i18n/labels';
import { describeApiError } from '../../models/api-error';
import { EntityAction } from '../../models/entity-form.model';
import { ConversationBase, ConversationEntry, ConversationService } from '../../services/conversation.service';
import { EntityApiService } from '../../services/entity-api.service';
import { MediaService } from '../../services/media.service';
import { MarkdownContent } from '../markdown-content/markdown-content';

/**
 * The conversation under a post: the questions, answers and decisions, oldest first, and a box to add to them. It is the durable
 * record of the collaboration (the same thread Claude reads and answers through its tools). Entries are only added; the human can
 * mark one as a decision, which the decisions page lists. Administrators only: the server refuses anyone else.
 *
 * Quick replies for a short visit: <b>Approve</b> approves the post and notes it in the thread in one tap, <b>Change request</b> starts a
 * reply that, when sent, also sends the post back with a request for changes, and <b>Ask</b> starts a question. They use the actions
 * the server offered for this post (links it supplied), so a post that is not under review simply has no Approve or Change request.
 */
@Component({
  selector: 'app-conversation',
  imports: [DatePipe, FormsModule, MatButtonModule, MatCheckboxModule, MatIconModule, MatTooltipModule, LabelPipe, MarkdownContent],
  templateUrl: './conversation.html',
  styleUrl: './conversation.scss',
})
export class Conversation {
  private readonly conversation = inject(ConversationService);
  private readonly entityApi = inject(EntityApiService);
  private readonly media = inject(MediaService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly postId = input.required<string>();
  /** Whether the conversation hangs under a post or a collaboration item (selects the API route). */
  readonly base = input<ConversationBase>('posts');

  /** The actions the server offered for this post (Approve and Request changes appear while it is under review). */
  readonly actions = input<EntityAction[]>([]);

  /** The post's review state changed (an Approve or Change request was sent): the host should read the post again. */
  readonly changed = output<void>();

  protected readonly entries = signal<ConversationEntry[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly sending = signal(false);
  protected text = '';
  protected asDecision = false;
  protected requestingChange = signal(false);
  protected approving = signal(false);
  protected readonly previewing = signal(false);
  protected readonly uploading = signal(false);

  /** Uploads the chosen image and inserts the Markdown that shows it where the cursor is in the reply box (at the end when the box is not focused). */
  protected insertImage(event: Event): void {
    const area = (this.host.nativeElement as HTMLElement).querySelector('textarea[name="text"]') as HTMLTextAreaElement | null;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.uploading.set(true);
    this.errors.set([]);
    this.media.upload(file).subscribe({
      next: (item) => {
        const start = area ? area.selectionStart : this.text.length;
        const end = area ? area.selectionEnd : this.text.length;
        const before = this.text.slice(0, start);
        const lead = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
        this.text = `${before}${lead}${item.markdown}\n${this.text.slice(end)}`;
        this.uploading.set(false);
      },
      error: (error) => {
        this.errors.set(describeApiError(error, 'Could not upload that image.'));
        this.uploading.set(false);
      },
    });
  }

  constructor() {
    effect(() => this.load(this.postId()));
  }

  protected actionLink(name: string): string | null {
    return this.actions().find((a) => a.name === name)?.link ?? null;
  }

  /** Takes a change request back: the item returns to review and the quick replies come back. */
  protected withdraw(): void {
    const link = this.actionLink('withdraw-changes');
    if (!link || this.sending()) {
      return;
    }

    this.begin();
    this.entityApi.runAction(link).subscribe({
      next: () => {
        this.sending.set(false);
        this.changed.emit();
      },
      error: (error) => this.fail(error),
    });
  }

  /**
   * Start a reply that, when sent, also approves the post (the way Change request works): whatever is already typed in the box stays and is sent
   * as the approval note, so nothing typed is lost. Nothing is approved until Send is pressed.
   */
  protected approve(): void {
    this.approving.set(true);
    this.requestingChange.set(false);
    if (!this.text.trim()) {
      this.text = 'Approved: ';
    }
  }

  /** Start a reply that, when sent, also sends the post back with a request for changes. */
  protected changeRequest(): void {
    this.approving.set(false);
    this.requestingChange.set(true);
    if (!this.text.trim()) {
      this.text = 'Change request: ';
    }
  }

  /** Start a question. */
  protected ask(): void {
    this.requestingChange.set(false);
    this.approving.set(false);
    if (!this.text.trim()) {
      this.text = 'Question: ';
    }
  }

  protected send(): void {
    const body = this.text.trim();
    if (!body || this.sending()) {
      return;
    }

    this.begin();
    // read before the reply is sent: sending clears the flag, and a change request is the one reply that changes the post's review state
    const wasChangeRequest = this.requestingChange();
    const wasApprove = this.approving();
    const sendIt = () => this.post(body, this.asDecision ? 'Decision' : 'Comment', () => {
      if (wasChangeRequest || wasApprove) {
        this.changed.emit();
      }
    });
    const review = this.requestingChange() ? this.actionLink('request-changes') : this.approving() ? this.actionLink('approve') : null;
    if (review) {
      this.entityApi.runAction(review).subscribe({ next: sendIt, error: (error) => this.fail(error) });
    } else {
      sendIt();
    }
  }

  private begin(): void {
    this.sending.set(true);
    this.errors.set([]);
  }

  private post(text: string, kind: 'Comment' | 'Decision', done: () => void): void {
    this.conversation.add(this.postId(), text, kind, this.base()).subscribe({
      next: (entry) => {
        this.entries.update((all) => [...all, entry]);
        this.text = '';
        this.asDecision = false;
        this.requestingChange.set(false);
        this.approving.set(false);
        this.previewing.set(false);
        this.sending.set(false);
        done();
      },
      error: (error) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.errors.set(describeApiError(error, 'Could not do that.'));
    this.sending.set(false);
  }

  private load(postId: string): void {
    this.errors.set([]);
    this.conversation.list(postId, this.base()).subscribe({
      next: (all) => this.entries.set(all),
      error: (error) => this.errors.set(describeApiError(error, 'Could not load the conversation.')),
    });
  }
}
