import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EmailVerificationPanel } from './email-verification-panel';

describe('EmailVerificationPanel', () => {
  function open(status: { address: string; verified: boolean }) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(EmailVerificationPanel);
    fixture.componentRef.setInput('userId', 'u1');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/users/u1/email-verification')).flush(status);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, http, element, page: fixture.componentInstance as unknown as { send(): void; state(): string } };
  }

  it('says a confirmed address is confirmed and offers no button', () => {
    const h = open({ address: 'a@b.org', verified: true });
    expect(h.element.textContent).toContain('a@b.org is confirmed');
    expect(h.element.querySelector('button')).toBeNull();
  });

  it('says an unconfirmed address is not confirmed and mails the person on the button', () => {
    const h = open({ address: 'a@b.org', verified: false });
    expect(h.element.textContent).toContain('not confirmed');
    expect(h.element.querySelector('button')).not.toBeNull();

    h.page.send();
    const request = h.http.expectOne((r) => r.url.endsWith('/api/users/u1/email-verification/request'));
    expect(request.request.body).toEqual({ clientBase: window.location.origin });
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(h.page.state()).toBe('sent');
  });

  it('asks for an address first when none is saved', () => {
    const h = open({ address: '', verified: false });
    expect(h.element.textContent).toContain('No e-mail address is saved');
    expect(h.element.querySelector('button')).toBeNull();
  });

  it('shows the server words when the mail cannot be sent', () => {
    const h = open({ address: 'a@b.org', verified: false });
    h.page.send();
    h.http.expectOne((r) => r.url.endsWith('/request')).flush('Mail is not set up on this site yet.', { status: 409, statusText: 'Conflict' });
    h.fixture.detectChanges();
    expect(h.page.state()).toBe('error');
    expect(h.element.textContent).toContain('Mail is not set up');
  });
});
