import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Setup } from './setup';

describe('Setup', () => {
  function setup(needsSetup: boolean) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(Setup);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/api/setup/status')).flush({ host: 'new.example.org', needsSetup });
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as {
      step(): string;
      signInForm: { setValue(v: object): void; getRawValue(): { password: string } };
      attachForm: { setValue(v: object): void };
      newForm: { setValue(v: object): void };
      signIn(): void;
      attach(): void;
      startNew(): void;
      error(): string | null;
    };
    return { fixture, http, page };
  }

  function signedIn(h: ReturnType<typeof setup>) {
    h.page.signInForm.setValue({ site: 'main.example.org', userName: 'Admin', password: 'secret' });
    h.page.signIn();
    h.http.expectOne((r) => r.url.endsWith('/api/setup/token')).flush({ accessToken: 'setup-token', expiresAtUtc: '2030-01-01T00:00:00Z' });
    const request = h.http.expectOne((r) => r.url.endsWith('/api/setup/sites'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer setup-token');
    request.flush([{ id: 't1', name: 'Main', domain: 'main.example.org' }]);
  }

  it('shows nothing to do for an address that needs no setup', () => {
    const h = setup(false);
    expect(h.page.step()).toBe('notNeeded');
  });

  it('asks for a sign-in on an address that needs setup, then offers the sites, and forgets the password', () => {
    const h = setup(true);
    expect(h.page.step()).toBe('signIn');
    signedIn(h);
    expect(h.page.step()).toBe('choose');
    expect(h.page.signInForm.getRawValue().password).toBe('');
  });

  it('says so plainly when the sign-in is refused', () => {
    const h = setup(true);
    h.page.signInForm.setValue({ site: 'main.example.org', userName: 'Admin', password: 'wrong' });
    h.page.signIn();
    h.http.expectOne((r) => r.url.endsWith('/api/setup/token')).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(h.page.step()).toBe('signIn');
    expect(h.page.error()).toBe('setupBadSignIn');
  });

  it('attaches the address to the chosen site', () => {
    const h = setup(true);
    signedIn(h);
    h.page.attachForm.setValue({ tenantId: 't1' });
    h.page.attach();
    const call = h.http.expectOne((r) => r.url.endsWith('/api/setup/attach'));
    expect(call.request.body).toEqual({ tenantId: 't1' });
    expect(call.request.headers.get('Authorization')).toBe('Bearer setup-token');
    call.flush({});
    expect(h.page.step()).toBe('done');
  });

  it('starts a new site with the name given', () => {
    const h = setup(true);
    signedIn(h);
    h.page.newForm.setValue({ name: ' Fresh ' });
    h.page.startNew();
    const call = h.http.expectOne((r) => r.url.endsWith('/api/setup/new'));
    expect(call.request.body).toEqual({ name: 'Fresh' });
    call.flush({});
    expect(h.page.step()).toBe('done');
  });
});
