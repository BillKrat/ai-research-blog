import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RecoveryService } from './recovery.service';

describe('RecoveryService', () => {
  function make() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return { service: TestBed.inject(RecoveryService), http: TestBed.inject(HttpTestingController) };
  }

  it('asks for a code with a plain post, and returns the challenge', () => {
    const { service, http } = make();
    let challenge: unknown;

    service.start().subscribe((c) => (challenge = c));
    const request = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/recovery/start'));
    request.flush({ code: 'abc', fileName: 'recovery-abc', folder: 'App_Data', expiresAtUtc: '2026-11-25T12:15:00Z' });

    expect(challenge).toEqual({ code: 'abc', fileName: 'recovery-abc', folder: 'App_Data', expiresAtUtc: '2026-11-25T12:15:00Z' });
  });

  it('sends the code, site, account and the chosen password to finish', () => {
    const { service, http } = make();

    service.complete('abc', 'main.example', 'Admin', 'my-new-password').subscribe();

    const request = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/recovery/complete'));
    expect(request.request.body).toEqual({ code: 'abc', site: 'main.example', userName: 'Admin', newPassword: 'my-new-password' });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
