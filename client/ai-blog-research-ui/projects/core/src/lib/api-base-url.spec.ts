import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api-base-url';
import { AuthService } from './services/auth.service';
import { EntityApiService } from './services/entity-api.service';
import { correlationHeader, correlationInterceptor } from './interceptors/correlation.interceptor';

/**
 * The API address is a setting the host supplies, not an import from the app's own environment file: that is what lets the services move into a library
 * that another app can reuse (S10).
 */
describe('API_BASE_URL', () => {
  const base = 'https://api.example.test';

  function configure(url?: string): HttpTestingController {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([correlationInterceptor])),
        provideHttpClientTesting(),
        ...(url === undefined ? [] : [{ provide: API_BASE_URL, useValue: url }]),
      ],
    });
    return TestBed.inject(HttpTestingController);
  }

  it('is empty (same origin) when the host does not set it', () => {
    configure();
    expect(TestBed.inject(API_BASE_URL)).toBe('');
  });

  it('prefixes the calls of an entity service', () => {
    const controller = configure(base);
    TestBed.inject(EntityApiService).followGrid('/api/users?page=2').subscribe();

    controller.expectOne(`${base}/api/users?page=2`).flush({ schema: { schemaIri: 'x', fields: [] }, rows: [] });
  });

  it('prefixes the sign-in call', () => {
    const controller = configure(base);
    TestBed.inject(AuthService).login('u', 'p').subscribe({ error: () => undefined });

    controller.expectOne(`${base}/api/auth/token`).flush({}, { status: 401, statusText: 'Unauthorized' });
  });

  it('sends the correlation id to the configured API and to no other site', () => {
    const controller = configure(base);
    const http = TestBed.inject(HttpClient);
    http.get(`${base}/api/health`).subscribe();
    http.get('https://example.com/x').subscribe();

    expect(controller.expectOne(`${base}/api/health`).request.headers.has(correlationHeader)).toBe(true);
    expect(controller.expectOne('https://example.com/x').request.headers.has(correlationHeader)).toBe(false);
  });
});
