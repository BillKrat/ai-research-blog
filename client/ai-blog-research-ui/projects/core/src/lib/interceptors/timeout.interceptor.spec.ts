import { HttpClient, HttpContext, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api-base-url';
import { API_TIMEOUT_MS, REQUEST_TIMEOUT_MS, timeoutInterceptor } from './timeout.interceptor';

/**
 * A server that accepts the connection and never answers (a stopped API behind a proxy does exactly this) left every screen on "Loading..." for good, with
 * nothing to say why. A request to our API now ends after a set time as the same failure an unreachable API gives (status 0), so the existing banner and the
 * screens' own error lines appear.
 */
describe('timeoutInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  function configure(providers: unknown[] = []): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([timeoutInterceptor])), provideHttpClientTesting(), ...(providers as never[])],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ends a request that is never answered, as an unreachable API (status 0, "Timeout")', () => {
    configure();
    let error: unknown;
    http.get('/api/pages').subscribe({ error: (e) => (error = e) });
    controller.expectOne('/api/pages');

    vi.advanceTimersByTime(14_999);
    expect(error).toBeUndefined();
    vi.advanceTimersByTime(2);

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(0);
    expect((error as HttpErrorResponse).statusText).toBe('Timeout');
  });

  it('leaves a request that is answered in time alone', () => {
    configure();
    let body: unknown;
    http.get('/api/pages').subscribe((b) => (body = b));

    vi.advanceTimersByTime(3_000);
    controller.expectOne('/api/pages').flush({ ok: true });
    vi.advanceTimersByTime(60_000);

    expect(body).toEqual({ ok: true });
  });

  it('uses the configured limit, and a longer one a request asks for (AI triage, uploads)', () => {
    configure([{ provide: API_TIMEOUT_MS, useValue: 2_000 }]);
    let quick: unknown;
    let patient: unknown;
    http.get('/api/pages').subscribe({ error: (e) => (quick = e) });
    http.get('/api/admin/diagnostics/x/ai-triage', { context: new HttpContext().set(REQUEST_TIMEOUT_MS, 60_000) }).subscribe({ error: (e) => (patient = e) });

    vi.advanceTimersByTime(2_001);
    expect(quick).toBeInstanceOf(HttpErrorResponse);
    expect(patient).toBeUndefined();
    vi.advanceTimersByTime(58_000);
    expect(patient).toBeInstanceOf(HttpErrorResponse);
  });

  it('does not time out calls to another site, and only watches the configured API', () => {
    configure([{ provide: API_BASE_URL, useValue: 'https://api.example.test' }]);
    let other: unknown = 'pending';
    let ours: unknown;
    http.get('https://example.com/x').subscribe({ next: () => undefined, error: (e) => (other = e) });
    http.get('https://api.example.test/api/pages').subscribe({ error: (e) => (ours = e) });

    vi.advanceTimersByTime(20_000);

    expect(other).toBe('pending');
    expect(ours).toBeInstanceOf(HttpErrorResponse);
  });

  it('passes a real server error through unchanged', () => {
    configure();
    let error: HttpErrorResponse | undefined;
    http.get('/api/pages').subscribe({ error: (e) => (error = e) });

    controller.expectOne('/api/pages').flush('boom', { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });
});
