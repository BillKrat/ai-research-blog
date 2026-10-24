// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let router: Router;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('auth.accessToken', 'tok');
    sessionStorage.setItem('auth.expiresAtUtc', new Date(Date.now() + 3_600_000).toISOString());
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => sessionStorage.clear());

  it('sends the token on a request', () => {
    http.get('/api/posts').subscribe();
    expect(controller.expectOne('/api/posts').request.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('drops the sign-in and goes to the login page, remembering the page, when the server answers 401', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let failed = false;
    http.get('/api/posts').subscribe({ error: () => (failed = true) });

    controller.expectOne('/api/posts').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.accessToken()).toBeNull();
    expect(sessionStorage.getItem('auth.accessToken')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1, returnUrl: router.url } });
  });

  it('leaves a 401 from signing in alone (wrong credentials, not an expired sign-in)', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http.post('/api/auth/token', {}).subscribe({ error: () => undefined });

    controller.expectOne('/api/auth/token').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does nothing about a 403 (signed in, just not allowed)', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http.get('/api/roles').subscribe({ error: () => undefined });

    controller.expectOne('/api/roles').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(auth.accessToken()).toBe('tok');
    expect(navigate).not.toHaveBeenCalled();
  });
});
