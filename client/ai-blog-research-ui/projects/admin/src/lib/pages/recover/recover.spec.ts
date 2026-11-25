import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Recover } from './recover';

describe('Recover', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Recover], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(Recover);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController), root: fixture.nativeElement as HTMLElement };
  }

  function getCode(h: ReturnType<typeof render>) {
    (h.root.querySelector('[data-action="get-code"]') as HTMLButtonElement).click();
    h.http.expectOne((r) => r.url.endsWith('/api/recovery/start')).flush({ code: 'c0de', fileName: 'recovery-c0de', folder: 'App_Data', expiresAtUtc: '2030-01-01T00:15:00Z' });
    h.fixture.detectChanges();
  }

  function fill(h: ReturnType<typeof render>, values: Record<string, string>) {
    for (const [name, value] of Object.entries(values)) {
      const input = h.root.querySelector(`[formcontrolname="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    h.fixture.detectChanges();
  }

  it('explains the idea first and asks nothing of the server until the button is used', () => {
    const h = render();

    expect(h.root.textContent).toContain('App_Data');
    h.http.expectNone((r) => r.url.includes('/api/recovery'));
    expect(h.root.querySelector('form')).toBeNull();
  });

  it('shows the file to create, the code and where, once a code is asked for', () => {
    const h = render();
    getCode(h);

    expect(h.root.textContent).toContain('recovery-c0de');
    expect(h.root.textContent).toContain('App_Data');
    expect(h.root.querySelector('form')).not.toBeNull();
  });

  it('sets the chosen password and says so, forgetting the password fields', () => {
    const h = render();
    getCode(h);
    fill(h, { site: 'main.example', userName: 'Admin', password: 'my-new-password', confirm: 'my-new-password' });

    (h.root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const request = h.http.expectOne((r) => r.url.endsWith('/api/recovery/complete'));
    expect(request.request.body).toEqual({ code: 'c0de', site: 'main.example', userName: 'Admin', newPassword: 'my-new-password' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    h.fixture.detectChanges();

    expect(h.root.textContent).toContain('password was changed');
    expect(h.root.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('does not send when the two passwords differ', () => {
    const h = render();
    getCode(h);
    fill(h, { site: '', userName: 'Admin', password: 'my-new-password', confirm: 'something-else' });

    (h.root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    h.fixture.detectChanges();

    h.http.expectNone((r) => r.url.endsWith('/api/recovery/complete'));
    expect(h.root.querySelector('[role="alert"]')?.textContent).toContain('do not match');
  });

  it('shows the server reason when the file is not found, and keeps the form for a retry', () => {
    const h = render();
    getCode(h);
    fill(h, { site: '', userName: 'Admin', password: 'my-new-password', confirm: 'my-new-password' });

    (h.root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    h.http.expectOne((r) => r.url.endsWith('/api/recovery/complete')).flush('The code is not valid, has expired, or its file was not found in the App_Data folder.', { status: 400, statusText: 'Bad Request' });
    h.fixture.detectChanges();

    expect(h.root.querySelector('[role="alert"]')?.textContent).toContain('file was not found');
    expect(h.root.querySelector('form')).not.toBeNull();
  });
});
