import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { VerifyEmail } from './verify-email';

/** The page the mailed link opens: it sends user and token to the server and says only "confirmed" or "not valid any more" (no reason). */
describe('VerifyEmail', () => {
  function open(query: Record<string, string>) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    const fixture = TestBed.createComponent(VerifyEmail);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController), page: fixture.componentInstance as unknown as { state(): string } };
  }

  it('posts the user and token from the link and shows the address as confirmed', () => {
    const h = open({ user: 'u1', token: 't1' });
    const request = h.http.expectOne((r) => r.url.endsWith('/api/email-verification/confirm'));
    expect(request.request.body).toEqual({ user: 'u1', token: 't1' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(h.page.state()).toBe('verified');
  });

  it('shows one plain failure for a refused token', () => {
    const h = open({ user: 'u1', token: 'bad' });
    h.http.expectOne((r) => r.url.endsWith('/api/email-verification/confirm')).flush('x', { status: 400, statusText: 'Bad Request' });
    expect(h.page.state()).toBe('failed');
  });

  it('does not call the server when the link has no token', () => {
    const h = open({ user: 'u1' });
    h.http.expectNone((r) => r.url.endsWith('/api/email-verification/confirm'));
    expect(h.page.state()).toBe('failed');
  });
});
