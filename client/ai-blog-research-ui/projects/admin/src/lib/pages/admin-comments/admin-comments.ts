import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommentAction, CommentsAdminService, ModerationComment } from '../../services/comments-admin.service';
import { AdminMenuService } from '@adventures/core';

/**
 * The Comments page (the legacy BlogEngine one, trimmed for the beta): what readers wrote under posts, filtered by Pending or Approved,
 * with Approve, Unapprove and Delete for the ticked comments. Only approved comments are shown on the site. The text is shown as plain text.
 */
import { PageHeader } from '../../components/page-header/page-header';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LabelPipe } from '@adventures/entity-ui';

@Component({
  selector: 'adv-admin-comments',
  imports: [DatePipe, RouterLink, PageHeader, MatIconModule, MatTooltipModule, LabelPipe],
  templateUrl: './admin-comments.html',
  styleUrl: './admin-comments.scss',
})
export class AdminComments implements OnInit {
  private readonly service = inject(CommentsAdminService);
  private readonly menu = inject(AdminMenuService);

  protected readonly comments = signal<ModerationComment[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly filter = signal<string>('');
  protected readonly problem = signal('');
  protected readonly noneSelected = computed(() => this.selected().size === 0);

  ngOnInit(): void {
    this.load();
  }

  protected setFilter(status: string): void {
    this.filter.set(status);
    this.load();
  }

  protected toggle(id: string): void {
    const next = new Set(this.selected());
    if (!next.delete(id)) {
      next.add(id);
    }

    this.selected.set(next);
  }

  protected toggleAll(checked: boolean): void {
    this.selected.set(checked ? new Set(this.comments().map((comment) => comment.id)) : new Set());
  }

  protected act(action: CommentAction): void {
    const ids = [...this.selected()];
    if (ids.length === 0) {
      return;
    }

    if (action === 'delete' && !window.confirm(`Delete ${ids.length} comment${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) {
      return;
    }

    this.problem.set('');
    this.service.process(action, ids).subscribe({
      next: () => {
        // the waiting-for-approval badge on the menu counts these comments
        this.menu.load();
        this.load();
      },
      error: () => this.problem.set('That did not work. Please try again.'),
    });
  }

  private load(): void {
    this.selected.set(new Set());
    this.service.list(this.filter() || null).subscribe({
      next: (list) => {
        this.problem.set('');
        this.comments.set(list);
      },
      error: () => this.problem.set('The comments could not be loaded.'),
    });
  }
}
