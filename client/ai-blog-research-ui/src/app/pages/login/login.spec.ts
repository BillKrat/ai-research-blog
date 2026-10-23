import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Login } from './login';

describe('Login return', () => {
  function setup(query: Record<string, string>) {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map(Object.entries(query)) } } },
      ],
    });
    const fixture = TestBed.createComponent(Login);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return { fixture, navigate, http: TestBed.inject(HttpTestingController), auth: TestBed.inject(AuthService) };
  }

  function signIn(fixture: ReturnType<typeof setup>['fixture'], http: HttpTestingController, mustChange: boolean) {
    const login = fixture.componentInstance as unknown as { form: { setValue(v: object): void }; submit(): void };
    login.form.setValue({ userName: 'Admin', password: 'x' });
    login.submit();
    http.expectOne((r) => r.url.endsWith('/api/auth/token')).flush({ accessToken: 't', expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(), mustChangePassword: mustChange });
    http.expectOne((r) => r.url.endsWith('/api/auth/whoami')).flush('Admin');
  }

  afterEach(() => sessionStorage.clear());

  it('returns to the page the person was on after signing in', () => {
    const { fixture, navigate, http } = setup({ expired: '1', returnUrl: '/admin/posts' });
    signIn(fixture, http, false);
    expect(navigate).toHaveBeenCalledWith('/admin/posts');
  });

  it('ignores a return address that leaves the app', () => {
    const { fixture, navigate, http } = setup({ returnUrl: '//evil.example' });
    signIn(fixture, http, false);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('goes to the profile for a forced password change and remembers the page for afterwards', () => {
    const { fixture, navigate, http, auth } = setup({ returnUrl: '/admin/posts' });
    signIn(fixture, http, true);
    expect(navigate).toHaveBeenCalledWith('/profile');
    expect(auth.takeReturnUrl()).toBe('/admin/posts');
    expect(auth.takeReturnUrl()).toBeNull();
  });
});
