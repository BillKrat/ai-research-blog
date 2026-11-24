import { Component, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmailVerificationService, VerificationStatus, describeApiError } from '@adventures/core';
import { LabelPipe } from '@adventures/entity-ui';

/**
 * On a person's screen: whether their saved e-mail address is confirmed, and for an address that is not, a button that mails them the confirmation link. The link needs no sign-in,
 * so a person who cannot sign in can still confirm and then use "Forgot my password". Save the person first if the address was just changed.
 */
@Component({
  selector: 'adv-email-verification-panel',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, LabelPipe],
  template: `
    <section class="email-verification">
      <h3>E-mail address</h3>
      @if (status(); as current) {
        @if (!current.address) {
          <p>No e-mail address is saved for this person. Save one above first.</p>
        } @else if (current.verified) {
          <p role="status"><mat-icon>verified</mat-icon> {{ current.address }} is confirmed.</p>
        } @else {
          <p>{{ current.address }} is <strong>not confirmed</strong>. Until it is, this person cannot get a password reset by mail.</p>
          @if (state() === 'sent') {
            <p role="status">The confirmation mail is on its way. When the person has opened the link, reload this page.</p>
          } @else if (state() === 'error') {
            <p class="email-verification__error" role="alert">{{ error() }}</p>
          }
          <button mat-icon-button color="primary" type="button" (click)="send()" [disabled]="state() === 'sending'" [matTooltip]="'sendVerificationToPerson' | label" [attr.aria-label]="'sendVerificationToPerson' | label">
            <mat-icon>forward_to_inbox</mat-icon>
          </button>
        }
      }
    </section>
  `,
  styles: `
    .email-verification__error {
      color: var(--mat-sys-error);
    }
  `,
})
export class EmailVerificationPanel implements OnInit {
  private readonly service = inject(EmailVerificationService);

  readonly userId = input.required<string>();

  protected readonly status = signal<VerificationStatus | null>(null);
  protected readonly state = signal<'idle' | 'sending' | 'sent' | 'error'>('idle');
  protected readonly error = signal('');

  ngOnInit(): void {
    this.service.statusOf(this.userId()).subscribe({ next: (status) => this.status.set(status), error: () => this.status.set(null) });
  }

  protected send(): void {
    if (this.state() === 'sending') {
      return;
    }

    this.state.set('sending');
    this.service.requestFor(this.userId()).subscribe({
      next: () => this.state.set('sent'),
      error: (failure) => {
        this.error.set(describeApiError(failure, 'The mail could not be sent. Check Admin > System > E-mail.').join(' '));
        this.state.set('error');
      },
    });
  }
}
