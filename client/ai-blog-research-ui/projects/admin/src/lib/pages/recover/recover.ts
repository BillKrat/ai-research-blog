import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RecoveryChallenge, RecoveryService } from '@adventures/core';
import { LabelPipe } from '@adventures/entity-ui';
import { PageHeader } from '../../components/page-header/page-header';

/**
 * Recovery for an owner who is locked out and has no working e-mail: get a one-time code, put a file named with it into the App_Data folder on the host, then choose a new
 * password for an account. It never resets to a default password. The same page is reached from the sign-in page and from the setup page of an address that reaches no site.
 */
@Component({
  selector: 'adv-recover',
  imports: [PageHeader, ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTooltipModule, LabelPipe],
  template: `
    <section class="recover">
      <adv-page-header [title]="'recoverTitle' | label" />
      @if (done()) {
        <p role="status">Your password was changed. Sign in with the new one.</p>
        <a routerLink="/login">{{ 'signIn' | label }}</a>
      } @else {
        <p>
          No e-mail is needed. You prove that you control this installation by putting a small file on the host, and then you choose a new password. Ask for a code, create an empty
          file named with it in the <strong>App_Data</strong> folder next to the app (over FTP or the hosting panel's file manager; create the folder if it is not there), and come back here.
        </p>
        @if (!challenge()) {
          <button mat-flat-button type="button" data-action="get-code" [disabled]="busy()" (click)="getCode()" [matTooltip]="'recoverGetCode' | label" [attr.aria-label]="'recoverGetCode' | label">
            <mat-icon>vpn_key</mat-icon> {{ 'recoverGetCode' | label }}
          </button>
          @if (error()) {
            <p role="alert">{{ error() }}</p>
          }
        } @else {
          <ol>
            <li>Create an empty file named <code>{{ challenge()!.fileName }}</code> in the <strong>{{ challenge()!.folder }}</strong> folder of the site (a <code>.txt</code> ending is fine).</li>
            <li>Fill in the form below and choose a new password. The code is good for 15 minutes and works once; if the site restarts, ask for a new one.</li>
          </ol>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Site address (leave empty for the site of this address)</mat-label>
              <input matInput formControlName="site" autocomplete="off" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>User name</mat-label>
              <input matInput formControlName="userName" autocomplete="username" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>New password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="new-password" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>New password again</mat-label>
              <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
            </mat-form-field>
            @if (error()) {
              <p role="alert">{{ error() }}</p>
            }
            <button mat-flat-button type="submit" [disabled]="form.invalid || busy()" [matTooltip]="'recoverSetPassword' | label" [attr.aria-label]="'recoverSetPassword' | label">
              <mat-icon>lock_reset</mat-icon> {{ 'recoverSetPassword' | label }}
            </button>
          </form>
        }
        <p><a routerLink="/login">{{ 'backToSignIn' | label }}</a></p>
      }
    </section>
  `,
})
export class Recover {
  private readonly service = inject(RecoveryService);

  protected readonly challenge = signal<RecoveryChallenge | null>(null);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup({
    site: new FormControl('', { nonNullable: true }),
    userName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  getCode(): void {
    this.busy.set(true);
    this.error.set('');
    this.service.start().subscribe({
      next: (challenge) => {
        this.busy.set(false);
        this.challenge.set(challenge);
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(error.status === 429 ? 'Too many tries. Wait a minute and try again.' : 'A code could not be made. Open the site by its own address and try again.');
      },
    });
  }

  submit(): void {
    const challenge = this.challenge();
    if (!challenge || this.form.invalid || this.busy()) {
      return;
    }

    const value = this.form.getRawValue();
    if (value.password !== value.confirm) {
      this.error.set('The two passwords do not match.');
      return;
    }

    this.busy.set(true);
    this.error.set('');
    this.service.complete(challenge.code, value.site.trim(), value.userName.trim(), value.password).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.reset();
        this.done.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.form.patchValue({ password: '', confirm: '' });
        this.error.set(this.messageOf(error));
      },
    });
  }

  private messageOf(error: HttpErrorResponse): string {
    if (error.status === 429) {
      return 'Too many tries. Wait a minute and try again.';
    }

    return typeof error.error === 'string' && error.error !== '' ? error.error : 'The password could not be changed. Try again.';
  }
}
