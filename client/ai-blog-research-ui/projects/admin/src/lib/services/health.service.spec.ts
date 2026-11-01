// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HealthService, describeFailures } from './health.service';

describe('describeFailures', () => {
  it('names each failed dependency with its code', () => {
    expect(
      describeFailures({
        dependencies: [
          { name: 'mcp', status: 'failed', durationMs: 5, detail: 'timeout' },
          { name: 'database', status: 'ok', durationMs: 3, detail: 'ok' },
        ],
      }),
    ).toBe('mcp (timeout)');
  });

  it('is empty when everything is ok or nothing was reported', () => {
    expect(describeFailures({ dependencies: [{ name: 'mcp', status: 'ok', durationMs: 1, detail: 'ok' }] })).toBe('');
    expect(describeFailures({})).toBe('');
  });
});

describe('HealthService.check', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return { service: TestBed.inject(HealthService), http: TestBed.inject(HttpTestingController) };
  }

  it('asks only the public endpoint when nobody is signed in', () => {
    const { service, http } = setup();
    service.check(false).subscribe();
    http.expectOne((r) => r.url.endsWith('/api/health')).flush({ status: 'Healthy', timestampUtc: '2026-10-27T00:00:00Z' });
    http.expectNone((r) => r.url.endsWith('/api/health/detail'));
  });

  it('asks for the detail when signed in', () => {
    const { service, http } = setup();
    let status = '';
    service.check(true).subscribe((h) => (status = h.status));
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush({ status: 'Degraded', timestampUtc: '2026-10-27T00:00:00Z' });
    expect(status).toBe('Degraded');
  });

  it('falls back to the public answer when the person may not read the detail', () => {
    const { service, http } = setup();
    let status = '';
    service.check(true).subscribe((h) => (status = h.status));
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush('', { status: 403, statusText: 'Forbidden' });
    http.expectOne((r) => r.url.endsWith('/api/health')).flush({ status: 'Healthy', timestampUtc: '2026-10-27T00:00:00Z' });
    expect(status).toBe('Healthy');
  });

  it('keeps a 503 from the detail as an answer instead of retrying the public one', () => {
    const { service, http } = setup();
    let status = '';
    service.check(true).subscribe({ error: (e) => (status = e.error.status) });
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush({ status: 'Unhealthy', timestampUtc: 'x' }, { status: 503, statusText: 'Unavailable' });
    http.expectNone((r) => r.url.endsWith('/api/health'));
    expect(status).toBe('Unhealthy');
  });
});
