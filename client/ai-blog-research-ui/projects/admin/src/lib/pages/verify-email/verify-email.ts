import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EmailVerificationService } from '@adventures/core';
import { PageHeader } from '../../components/page-header/page-header';

type State = 'checking' | 'verified' | 'failed';

/** The page the mailed link opens: it sends the token to the server and says whether the address is now verified. It gives no reason for a failure. */
@Component({
  selector: 'adv-verify-email',
  imports: [PageHeader, RouterLink],
  template: `
    <adv-page-header title="Confirm your e-mail address" />
    @switch (state()) {
      @case ('checking') {
        <p>Checking the link...</p>
      }
      @case ('verified') {
        <p role="status">Thank you. Your e-mail address is confirmed.</p>
        <a routerLink="/profile">Back to your profile</a>
      }
      @case ('failed') {
        <p role="alert">This link is not valid any more. Sign in, open your profile and ask for a new one.</p>
        <a routerLink="/login">Sign in</a>
      }
    }
  `,
})
export class VerifyEmail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EmailVerificationService);

  protected readonly state = signal<State>('checking');

  ngOnInit(): void {
    const user = this.route.snapshot.queryParamMap.get('user') ?? '';
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!user || !token) {
      this.state.set('failed');
      return;
    }

    this.service.confirm(user, token).subscribe({ next: () => this.state.set('verified'), error: () => this.state.set('failed') });
  }
}
