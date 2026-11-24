import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PasswordResetService } from '@adventures/core';
import { LabelPipe } from '@adventures/entity-ui';
import { PageHeader } from '../../components/page-header/page-header';

/** Asks for a reset link. The answer is the same whether or not the name or address is known, so this page can not be used to find out who has an account. */
@Component({
  selector: 'adv-forgot-password',
  imports: [PageHeader, ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTooltipModule, LabelPipe],
  template: `
    <section class="login">
      <adv-page-header [title]="'forgotPassword' | label" />
      @if (sent()) {
        <p role="status">If that name or address belongs to an account whose e-mail address has been confirmed, a link to choose a new password is on its way (it works once and for one hour). Nothing is sent for an address that was never confirmed: sign in and confirm it on your profile, or ask an administrator to send you the confirmation mail from Admin > Users.</p>
        <a routerLink="/login">Back to sign in</a>
      } @else {
        <p>Give your user name or the e-mail address saved on your profile. A link is mailed only to an address you have confirmed.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>User name or e-mail address</mat-label>
            <input matInput formControlName="identifier" autocomplete="username" />
          </mat-form-field>
          @if (error()) {
            <p role="alert">{{ error() }}</p>
          }
          <button mat-flat-button type="submit" [disabled]="form.invalid || busy()" [matTooltip]="'sendResetLink' | label" [attr.aria-label]="'sendResetLink' | label">
            <mat-icon>forward_to_inbox</mat-icon> {{ 'sendResetLink' | label }}
          </button>
        </form>
        <a routerLink="/login">Back to sign in</a>
      }
    </section>
  `,
})
export class ForgotPassword {
  private readonly service = inject(PasswordResetService);

  protected readonly form = new FormGroup({ identifier: new FormControl('', { nonNullable: true, validators: [Validators.required] }) });
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');

  submit(): void {
    if (this.form.invalid || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set('');
    this.service.request(this.form.getRawValue().identifier.trim()).subscribe({
      next: () => this.sent.set(true),
      error: () => {
        this.busy.set(false);
        this.error.set('The request could not be sent. Open the site by its own address and try again.');
      },
    });
  }
}
