import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActingTenantService } from '../services/acting-tenant.service';
import { ACTING_TENANT_REFUSED, actingTenantInterceptor } from './acting-tenant.interceptor';

describe('actingTenantInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let acting: ActingTenantService;

  const stored = new Map<string, string>();

  function setUp(signedIn: boolean): void {
    stored.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
      removeItem: (key: string) => void stored.delete(key),
      clear: () => stored.clear(),
    });
    sessionStorage.clear();
    stored.clear();
    if (signedIn) {
      sessionStorage.setItem('auth.accessToken', 'tok');
      sessionStorage.setItem('auth.expiresAtUtc', new Date(Date.now() + 3_600_000).toISOString());
    }
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([actingTenantInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    acting = TestBed.inject(ActingTenantService);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    stored.clear();
  });

  it('sends the chosen tenant on a signed-in call to the API', () => {
    setUp(true);
    acting.choose('t-2');

    http.get('/api/posts').subscribe();

    expect(controller.expectOne('/api/posts').request.headers.get('X-Acting-Tenant')).toBe('t-2');
  });

  it('sends nothing when no tenant was chosen', () => {
    setUp(true);

    http.get('/api/posts').subscribe();

    expect(controller.expectOne('/api/posts').request.headers.has('X-Acting-Tenant')).toBe(false);
  });

  it('sends nothing when nobody is signed in, and nothing to another site', () => {
    setUp(false);
    acting.choose('t-2');

    http.get('/api/public/posts').subscribe();
    http.get('https://elsewhere.example/data').subscribe();

    expect(controller.expectOne('/api/public/posts').request.headers.has('X-Acting-Tenant')).toBe(false);
    expect(controller.expectOne('https://elsewhere.example/data').request.headers.has('X-Acting-Tenant')).toBe(false);
  });

  it('drops the choice and reloads when the server refuses it', () => {
    setUp(true);
    acting.choose('t-gone');
    const reload = vi.spyOn(acting, 'reload').mockImplementation(() => undefined);

    http.get('/api/posts').subscribe({ error: () => undefined });
    controller.expectOne('/api/posts').flush({ title: ACTING_TENANT_REFUSED }, { status: 403, statusText: 'Forbidden' });

    expect(acting.id()).toBeNull();
    expect(stored.get('adventures.actingTenant') ?? null).toBeNull();
    expect(reload).toHaveBeenCalled();
  });

  it('leaves any other 403 alone (a missing right is not a refused tenant)', () => {
    setUp(true);
    acting.choose('t-2');
    const reload = vi.spyOn(acting, 'reload').mockImplementation(() => undefined);

    http.get('/api/users').subscribe({ error: () => undefined });
    controller.expectOne('/api/users').flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(acting.id()).toBe('t-2');
    expect(reload).not.toHaveBeenCalled();
  });
});
