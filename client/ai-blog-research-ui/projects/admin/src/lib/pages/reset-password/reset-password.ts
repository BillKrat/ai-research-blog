import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PasswordResetService } from '@adventures/core';
import { LabelPipe } from '@adventures/entity-ui';
import { PageHeader } from '../../components/page-header/page-header';

/** The page the mailed link opens: choose a new password. A link that is wrong, used or expired gets one plain message. */
@Component({
  selector: 'adv-reset-password',
  imports: [PageHeader, ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTooltipModule, LabelPipe],
  template: `
    <section class="login">
      <adv-page-header [title]="'setNewPassword' | label" />
      @if (done()) {
        <p role="status">Your password is changed. You can sign in with it now.</p>
        <a routerLink="/login">Sign in</a>
      } @else if (!user || !token) {
        <p role="alert">This link is not valid any more. Ask for a new one from the sign-in page.</p>
        <a routerLink="/forgot-password">Ask for a new link</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>New password (at least 12 characters)</mat-label>
            <input matInput type="password" formControlName="next" autocomplete="new-password" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Type it again</mat-label>
            <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
          </mat-form-field>
          @if (error()) {
            <p role="alert">{{ error() }}</p>
          }
          <button mat-flat-button type="submit" [disabled]="form.invalid || busy()" [matTooltip]="'setNewPassword' | label" [attr.aria-label]="'setNewPassword' | label">
            <mat-icon>key</mat-icon> {{ 'setNewPassword' | label }}
          </button>
        </form>
        @if (invalid()) {
          <a routerLink="/forgot-password">Ask for a new link</a>
        }
      }
    </section>
  `,
})
export class ResetPassword {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PasswordResetService);

  protected readonly user = this.route.snapshot.queryParamMap.get('user') ?? '';
  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected readonly form = new FormGroup({
    next: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12)] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly invalid = signal(false);
  protected readonly error = signal('');

  submit(): void {
    const { next, confirm } = this.form.getRawValue();
    if (this.form.invalid || this.busy()) {
      return;
    }

    if (next !== confirm) {
      this.error.set('The two passwords are not the same.');
      return;
    }

    this.busy.set(true);
    this.error.set('');
    this.service.reset(this.user, this.token, next).subscribe({
      next: () => this.done.set(true),
      error: (failure: HttpErrorResponse) => {
        this.busy.set(false);
        if (failure.status === 422) {
          this.error.set(typeof failure.error === 'string' ? failure.error : 'Choose a longer password.');
        } else {
          this.invalid.set(true);
          this.error.set('This link is not valid any more. Ask for a new one.');
        }
      },
    });
  }
}
