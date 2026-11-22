import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { SiteService } from '../../services/site.service';
import { PublicComment, PublicContentService } from '../../services/public-content.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '@adventures/entity-ui';

/**
 * The comments under a post: the approved ones (plain text only, never markup) and a form that sends a new one. A new comment waits for
 * a person to approve it, and the page says so. The form carries a hidden field only a robot fills in; the server drops those quietly.
 */
@Component({
  selector: 'adv-post-comments',
  imports: [DatePipe, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './post-comments.html',
  styleUrl: './post-comments.scss',
})
export class PostComments implements OnInit {
  private readonly content = inject(PublicContentService);
  private readonly site = inject(SiteService);

  /** False when an administrator turned comments off for the whole site: the form goes, the comments that exist stay. */
  protected readonly open = computed(() => this.site.settings().commentsEnabled !== false);

  /** False only when an administrator switched moderation off: then the page must not promise a review. */
  protected readonly moderated = computed(() => this.site.settings().commentsModerate !== false);

  readonly slug = input.required<string>();

  protected readonly comments = signal<PublicComment[]>([]);
  protected readonly notice = signal('');
  protected readonly problem = signal('');
  protected readonly sending = signal(false);

  ngOnInit(): void {
    this.content.comments(this.slug()).subscribe({
      next: (list) => this.comments.set(list),
      error: () => this.comments.set([]),
    });
  }

  protected send(form: HTMLFormElement, author: string, email: string, body: string, website: string): void {
    this.notice.set('');
    this.problem.set('');
    if (author.trim() === '' || body.trim() === '') {
      this.problem.set('Please give your name and a comment.');
      return;
    }

    this.sending.set(true);
    this.content.submitComment(this.slug(), { author: author.trim(), email: email.trim(), body: body.trim(), website }).subscribe({
      next: (answer) => {
        this.sending.set(false);
        this.notice.set(answer.message);
        form.reset();
      },
      error: (error: HttpErrorResponse) => {
        this.sending.set(false);
        this.problem.set(this.messageOf(error));
      },
    });
  }

  private messageOf(error: HttpErrorResponse): string {
    if (error.status === 429) {
      return 'You are sending comments too quickly. Please wait a minute and try again.';
    }

    if (error.status === 409 && typeof error.error === 'string' && error.error !== '') {
      return error.error;
    }

    return 'Your comment could not be sent. Please try again.';
  }
}
