import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EmailVerificationService } from './email-verification.service';

describe('EmailVerificationService', () => {
  function configure() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return { service: TestBed.inject(EmailVerificationService), http: TestBed.inject(HttpTestingController) };
  }

  it('asks for a mail with the address this page was opened at, never an address to mail', () => {
    const h = configure();
    h.service.request().subscribe();
    const request = h.http.expectOne((r) => r.url.endsWith('/api/email-verification/request'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ clientBase: window.location.origin });
    request.flush(null);
  });

  it('reads the status', () => {
    const h = configure();
    let seen: unknown;
    h.service.status().subscribe((s) => (seen = s));
    h.http.expectOne((r) => r.url.endsWith('/api/email-verification')).flush({ address: 'a@b.org', verified: false });
    expect(seen).toEqual({ address: 'a@b.org', verified: false });
  });

  it('sends the user and token to confirm', () => {
    const h = configure();
    h.service.confirm('u', 't').subscribe();
    const request = h.http.expectOne((r) => r.url.endsWith('/api/email-verification/confirm'));
    expect(request.request.body).toEqual({ user: 'u', token: 't' });
    request.flush(null);
  });
});
