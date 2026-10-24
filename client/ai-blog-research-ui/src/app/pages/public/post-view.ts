// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { ApprovalBadge } from '../../components/approval-badge/approval-badge';
import { DraftBadge } from '../../components/draft-badge/draft-badge';
import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentTools } from '../../components/content-tools/content-tools';
import { MarkdownContent } from '../../components/markdown-content/markdown-content';
import { PublicContentService, PublicPost } from '../../services/public-content.service';

/** One published post: title, who and when, its categories and tags as links, and the rendered Markdown. A draft or unknown slug is a 404. */
@Component({
  selector: 'app-post-view',
  imports: [RouterLink, DatePipe, MarkdownContent, ContentTools, DraftBadge, ApprovalBadge],
  templateUrl: './post-view.html',
  styleUrl: './public.scss',
})
export class PostView implements OnInit {
  private readonly content = inject(PublicContentService);
  private readonly route = inject(ActivatedRoute);

  protected readonly post = signal<PublicPost | null>(null);
  protected readonly notFound = signal(false);
  protected readonly isLoading = signal(true);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.isLoading.set(true);
      this.notFound.set(false);
      this.content.post(params.get('slug') ?? '').subscribe({
        next: (post) => {
          this.post.set(post);
          this.isLoading.set(false);
        },
        error: () => {
          this.post.set(null);
          this.notFound.set(true);
          this.isLoading.set(false);
        },
      });
    });
  }
}
