import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ForgotPassword } from '../forgot-password/forgot-password';
import { ResetPassword } from './reset-password';

type ResetPage = { form: { setValue(v: object): void }; submit(): void; done(): boolean; error(): string; invalid(): boolean };

describe('Forgot and reset password pages', () => {
  function configure(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    return TestBed.inject(HttpTestingController);
  }

  it('asks for a link with the typed name and this page address, and then says the same thing whatever the answer was', () => {
    const http = configure();
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as { form: { setValue(v: object): void }; submit(): void; sent(): boolean };

    page.form.setValue({ identifier: ' Bill ' });
    page.submit();
    const request = http.expectOne((r) => r.url.endsWith('/api/password-reset/request'));
    expect(request.request.body).toEqual({ identifier: 'Bill', clientBase: window.location.origin });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(page.sent()).toBe(true);
  });

  it('sends the user, token and the new password from the link and says it is done', () => {
    const http = configure({ user: 'u1', token: 't1' });
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as ResetPage;

    page.form.setValue({ next: 'a long new password 1', confirm: 'a long new password 1' });
    page.submit();
    const request = http.expectOne((r) => r.url.endsWith('/api/password-reset/reset'));
    expect(request.request.body).toEqual({ user: 'u1', token: 't1', newPassword: 'a long new password 1' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(page.done()).toBe(true);
  });

  it('does not call the server when the two passwords differ', () => {
    const http = configure({ user: 'u1', token: 't1' });
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as ResetPage;

    page.form.setValue({ next: 'a long new password 1', confirm: 'a different long one 2' });
    page.submit();

    http.expectNone((r) => r.url.endsWith('/api/password-reset/reset'));
    expect(page.error()).toContain('not the same');
  });

  it('shows the server words for a weak password and one plain message for a bad link', () => {
    const http = configure({ user: 'u1', token: 't1' });
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as ResetPage;

    page.form.setValue({ next: 'a long new password 1', confirm: 'a long new password 1' });
    page.submit();
    http.expectOne((r) => r.url.endsWith('/api/password-reset/reset')).flush('Choose a longer password: At least 12 characters', { status: 422, statusText: 'Unprocessable' });
    expect(page.error()).toContain('Choose a longer password');
    expect(page.invalid()).toBe(false);

    page.submit();
    http.expectOne((r) => r.url.endsWith('/api/password-reset/reset')).flush('x', { status: 400, statusText: 'Bad Request' });
    expect(page.invalid()).toBe(true);
    expect(page.error()).toContain('not valid any more');
  });

  it('a link with no token is shown as invalid without asking the server', () => {
    const http = configure({ user: 'u1' });
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();

    http.expectNone(() => true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('not valid any more');
  });
});
