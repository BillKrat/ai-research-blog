import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarkdownContent } from '../../components/markdown-content/markdown-content';
import { describeApiError } from '../../models/api-error';
import { DecisionEntry, ConversationService } from '../../services/conversation.service';

/**
 * The decisions page: every entry the human recorded as a decision under a post, newest first, each with the post it belongs to and a
 * link to it. A read-only list; a decision is recorded in the Conversation under a post (tick "Record as a decision"). Administrators only.
 */
@Component({
  selector: 'app-admin-decisions',
  imports: [DatePipe, RouterLink, MarkdownContent],
  templateUrl: './admin-decisions.html',
  styleUrl: './admin-decisions.scss',
})
export class AdminDecisions implements OnInit {
  private readonly api = inject(ConversationService);

  protected readonly decisions = signal<DecisionEntry[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly isLoading = signal(true);

  ngOnInit(): void {
    this.api.decisions().subscribe({
      next: (all) => {
        this.decisions.set(all);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errors.set(describeApiError(error, 'Could not load the decisions.'));
        this.isLoading.set(false);
      },
    });
  }
}
