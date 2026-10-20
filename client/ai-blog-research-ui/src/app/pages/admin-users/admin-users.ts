import { Component, OnInit, inject, signal } from '@angular/core';
import { EntityGrid, GridRequest } from '../../components/entity-grid/entity-grid';
import { describeApiError } from '../../models/api-error';
import { EntityGridModel } from '../../models/entity-form.model';
import { AdminUsersService } from '../../services/admin-users.service';

/**
 * Admin > Users: the first screen on the grid contract. It holds no knowledge of what a user is: it fetches the grid
 * model, renders it with the reusable grid, and turns the grid's requests (next, previous, sort) into either a link the
 * server supplied or a sorted first page. Adding Roles or Posts later is the same screen with another collection path.
 */
@Component({
  selector: 'app-admin-users',
  imports: [EntityGrid],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
})
export class AdminUsers implements OnInit {
  private readonly service = inject(AdminUsersService);

  protected readonly model = signal<EntityGridModel | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errors = signal<string[]>([]);

  ngOnInit(): void {
    this.load(this.service.first());
  }

  protected onRequest(request: GridRequest): void {
    const current = this.model();
    if (!current) {
      return;
    }

    switch (request.kind) {
      case 'next':
        if (current.links?.next) {
          this.load(this.service.follow(current.links.next));
        }
        break;
      case 'previous':
        if (current.links?.previous) {
          this.load(this.service.follow(current.links.previous));
        }
        break;
      case 'sort':
        this.load(this.service.first({ sort: request.field, descending: request.descending, pageSize: current.paging?.pageSize }));
        break;
    }
  }

  private load(source: ReturnType<AdminUsersService['first']>): void {
    this.isLoading.set(true);
    this.errors.set([]);
    source.subscribe({
      next: (grid) => {
        this.model.set(grid);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errors.set(describeApiError(error, "Couldn't load the users."));
      },
    });
  }
}
