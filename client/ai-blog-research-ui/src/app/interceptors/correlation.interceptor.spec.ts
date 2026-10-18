import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { correlationHeader, correlationInterceptor } from './correlation.interceptor';

describe('correlationInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([correlationInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('gives each request to our API its own 32-character id', () => {
    http.get('/api/health').subscribe();
    http.get('/api/health').subscribe();

    const ids = controller.match('/api/health').map((request) => request.request.headers.get(correlationHeader));
    expect(ids[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(ids[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('keeps an id the caller already set', () => {
    http.get('/api/health', { headers: { [correlationHeader]: 'mine-1' } }).subscribe();

    expect(controller.expectOne('/api/health').request.headers.get(correlationHeader)).toBe('mine-1');
  });

  it('does not send the id to another site', () => {
    http.get('https://example.com/x').subscribe();

    expect(controller.expectOne('https://example.com/x').request.headers.has(correlationHeader)).toBe(false);
  });
});
