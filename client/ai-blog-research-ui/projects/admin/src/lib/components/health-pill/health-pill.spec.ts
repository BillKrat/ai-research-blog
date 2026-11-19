import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiProblemService } from '@adventures/core';
import { HealthPill } from './health-pill';

describe('HealthPill', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [HealthPill],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  function open() {
    const fixture = TestBed.createComponent(HealthPill);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    return { fixture, http, root: fixture.nativeElement as HTMLElement };
  }

  const detail = (status: string, dependencies: object[] = []) => ({ status, timestampUtc: '2026-11-19T12:00:00Z', dependencies, correlationId: 'trace-1' });

  it('asks for the health only when it is on screen, and says it is checking until the answer comes', () => {
    const { http, root } = open();

    expect(root.textContent).toContain('API: checking');
    http.expectOne((r) => r.url.endsWith('/api/health') || r.url.endsWith('/api/health/detail'));
  });

  it('shows a healthy API', () => {
    const { fixture, http, root } = open();

    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush(detail('Healthy'));
    fixture.detectChanges();

    expect(root.querySelector('.badge--success')?.textContent).toContain('API: healthy');
  });

  it('names what failed when the API is degraded or unhealthy', () => {
    const { fixture, http, root } = open();
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush(detail('Degraded', [{ name: 'mcp', status: 'failed', durationMs: 10, detail: 'timeout' }]));
    fixture.detectChanges();
    expect(root.querySelector('.badge--warning')?.textContent).toContain('API: degraded (mcp (timeout))');
    expect(root.querySelector('.badge--warning')?.getAttribute('title')).toContain('trace-1');

    vi.advanceTimersByTime(120_000);
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush(detail('Unhealthy', [{ name: 'database', status: 'failed', durationMs: 5, detail: 'down' }]), { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(root.querySelector('.badge--danger')?.textContent).toContain('API: unhealthy (database (down))');
  });

  it('says unreachable when nothing answers, and as soon as any other call to the API goes unanswered', () => {
    const { fixture, http, root } = open();
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush(detail('Healthy'));
    fixture.detectChanges();
    expect(root.textContent).toContain('API: healthy');

    TestBed.inject(ApiProblemService).reportHttp(new HttpErrorResponse({ status: 0 }));
    fixture.detectChanges();

    expect(root.textContent).toContain('API: unreachable');
  });

  it('looks again every two minutes, and stops when it leaves the screen', () => {
    const { fixture, http } = open();
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush(detail('Healthy'));

    vi.advanceTimersByTime(120_000);
    http.expectOne((r) => r.url.endsWith('/api/health/detail')).flush(detail('Healthy'));

    fixture.destroy();
    vi.advanceTimersByTime(600_000);
    http.expectNone((r) => r.url.includes('/api/health'));
  });
});
