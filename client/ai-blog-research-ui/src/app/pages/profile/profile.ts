import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { EntityForm } from '../../components/entity-form/entity-form';
import { EntityDataModel, EntityFormModel } from '../../models/entity-form.model';
import { ProfileService } from '../../services/profile.service';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type DeleteState = 'idle' | 'deleting' | 'error';

/**
 * Hosts the reusable EntityForm for the current user's own profile - the Schema/Entity pair now
 * comes from the real, schema-driven Adventures.Entities.User engine (Adventures.Foundation),
 * not a hand-written field list, so First/Last/Phone/DOB show up here without any client change
 * when the backend schema grows. "Delete my account" exists specifically to demonstrate the
 * server's delete-own-account guard, which always rejects this exact call.
 */
@Component({
  selector: 'app-profile',
  imports: [MatButtonModule, EntityForm],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private readonly profileService = inject(ProfileService);

  protected readonly model = signal<EntityFormModel | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly saveState = signal<SaveState>('idle');
  protected readonly deleteState = signal<DeleteState>('idle');

  ngOnInit(): void {
    this.profileService.getMyProfile().subscribe({
      next: (form) => {
        this.model.set(form);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  onSave(values: Record<string, string | null>): void {
    const current = this.model();
    if (!current || this.saveState() === 'saving') {
      return;
    }

    this.saveState.set('saving');
    const request: EntityDataModel = { entityId: current.entity.entityId, values };
    this.profileService.updateMyProfile(request).subscribe({
      next: (form) => {
        this.model.set(form);
        this.saveState.set('saved');
      },
      error: () => this.saveState.set('error'),
    });
  }

  deleteMyAccount(): void {
    if (this.deleteState() === 'deleting') {
      return;
    }

    this.deleteState.set('deleting');
    this.profileService.deleteMyAccount().subscribe({
      next: () => this.deleteState.set('idle'),
      error: () => this.deleteState.set('error'),
    });
  }
}
