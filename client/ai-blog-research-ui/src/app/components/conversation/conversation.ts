import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '../../i18n/labels';
import { describeApiError } from '../../models/api-error';
import { ConversationEntry, ConversationService } from '../../services/conversation.service';
import { MarkdownContent } from '../markdown-content/markdown-content';

/**
 * The conversation under a post: the questions, answers and decisions, oldest first, and a box to add to them. It is the durable
 * record of the collaboration (the same thread Claude reads and answers through its tools). Entries are only added; the human can
 * mark one as a decision, which a decisions page will later list. Administrators only: the server refuses anyone else.
 */
@Component({
  selector: 'app-conversation',
  imports: [DatePipe, FormsModule, MatButtonModule, MatCheckboxModule, MatIconModule, MatTooltipModule, LabelPipe, MarkdownContent],
  templateUrl: './conversation.html',
  styleUrl: './conversation.scss',
})
export class Conversation {
  private readonly api = inject(ConversationService);

  readonly postId = input.required<string>();

  protected readonly entries = signal<ConversationEntry[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly sending = signal(false);
  protected text = '';
  protected asDecision = false;

  constructor() {
    effect(() => this.load(this.postId()));
  }

  protected send(): void {
    const body = this.text.trim();
    if (!body || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.errors.set([]);
    this.api.add(this.postId(), body, this.asDecision ? 'Decision' : 'Comment').subscribe({
      next: (entry) => {
        this.entries.update((all) => [...all, entry]);
        this.text = '';
        this.asDecision = false;
        this.sending.set(false);
      },
      error: (error) => {
        this.errors.set(describeApiError(error, 'Could not add that.'));
        this.sending.set(false);
      },
    });
  }

  private load(postId: string): void {
    this.errors.set([]);
    this.api.list(postId).subscribe({
      next: (all) => this.entries.set(all),
      error: (error) => this.errors.set(describeApiError(error, 'Could not load the conversation.')),
    });
  }
}
