import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ProfileField, ProfileService } from '../../services/profile.service';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Renders whatever fields the server sends (ProfileController.cs's ProfileField list) from one
 * generic loop, the same technique poc/nquad-end-to-end-poc's app-screen.html demonstrates for a
 * fully schema-driven entity form - a field is rendered by iterating metadata, not by a
 * hand-written <input> per property. This is deliberately the "modest" version recommended in
 * docs/SESSION_HANDOFF.md's 2026-09-23 "NEXT UP" entry, gap 3: one real entity (the current user),
 * not the full GenericDal/GenericBll engine, which doesn't exist in this repo yet.
 */
@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private readonly profileService = inject(ProfileService);

  protected readonly fields = signal<ProfileField[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly saveState = signal<SaveState>('idle');
  protected readonly form = new UntypedFormGroup({});

  ngOnInit(): void {
    this.profileService.getMyProfile().subscribe((response) => this.applyFields(response.fields));
  }

  submit(): void {
    if (this.form.invalid || this.saveState() === 'saving') {
      return;
    }

    this.saveState.set('saving');
    this.profileService
      .updateMyProfile({
        email: this.form.controls['email'].value as string,
        displayName: this.form.controls['display_name'].value as string,
      })
      .subscribe({
        next: (response) => {
          this.applyFields(response.fields);
          this.saveState.set('saved');
        },
        error: () => this.saveState.set('error'),
      });
  }

  private applyFields(fields: ProfileField[]): void {
    this.fields.set(fields);
    this.isLoading.set(false);

    for (const key of Object.keys(this.form.controls)) {
      this.form.removeControl(key);
    }
    for (const field of fields) {
      const validators = field.isRequired ? [Validators.required] : [];
      const control = new UntypedFormControl(field.value, validators);
      if (field.isReadOnly) {
        control.disable();
      }
      this.form.addControl(field.id, control);
    }
  }
}
