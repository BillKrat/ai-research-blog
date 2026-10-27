import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { describeApiError } from '../../models/api-error';
import { RightInfo, RolesApiService } from '../../services/roles-api.service';

/**
 * What a role allows, as a checklist of the server's rights catalog. A role stored as "*" shows every right ticked. Saving sends the
 * ticked names to the role; a refusal (for example taking away your own ability to manage users and roles) is shown in the server's
 * words and the ticks stay as they were typed. Nothing about which rights exist lives here: the catalog is read from the server.
 */
@Component({
  selector: 'app-rights-checklist',
  templateUrl: './rights-checklist.html',
  styleUrl: './rights-checklist.scss',
})
export class RightsChecklist implements OnInit {
  private readonly api = inject(RolesApiService);

  readonly roleId = input.required<string>();
  /** The role's stored rights: comma separated names, or "*". */
  readonly rights = input.required<string>();
  readonly canEdit = input(true);
  /** The server accepted the change: the host should reload the role. */
  readonly saved = output<void>();

  protected readonly catalog = signal<RightInfo[]>([]);
  protected readonly ticked = signal<ReadonlySet<string>>(new Set());
  protected readonly errors = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly status = signal('');
  protected readonly dirty = computed(() => this.status() === 'changed');

  ngOnInit(): void {
    this.api.catalog().subscribe({
      next: (catalog) => {
        // Alphabetical by name so a long list can be scanned like an index, whatever order the server keeps.
        catalog = [...catalog].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        this.catalog.set(catalog);
        const stored = this.rights().trim();
        this.ticked.set(
          stored === '*' ? new Set(catalog.map((r) => r.name)) : new Set(stored.split(',').map((n) => n.trim()).filter(Boolean)),
        );
      },
      error: (error) => this.errors.set(describeApiError(error, 'Could not load the list of rights.')),
    });
  }

  protected toggle(name: string): void {
    const next = new Set(this.ticked());
    if (!next.delete(name)) {
      next.add(name);
    }
    this.ticked.set(next);
    this.status.set('changed');
  }

  protected save(): void {
    this.saving.set(true);
    this.errors.set([]);
    this.api.setRights(this.roleId(), this.catalog().map((r) => r.name).filter((n) => this.ticked().has(n))).subscribe({
      next: () => {
        this.saving.set(false);
        this.status.set('saved');
        this.saved.emit();
      },
      error: (error) => {
        this.saving.set(false);
        this.errors.set(describeApiError(error, 'The rights were not saved.'));
      },
    });
  }
}
