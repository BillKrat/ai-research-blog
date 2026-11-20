import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

/** A person who must change their password first can reach the profile page and nothing else behind the guard. */
describe('authGuard', () => {
  let router: Router;

  const run = (url: string) =>
    TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

  const signIn = (mustChange: boolean) => {
    sessionStorage.setItem('auth.accessToken', 'tok');
    sessionStorage.setItem('auth.expiresAtUtc', new Date(Date.now() + 3_600_000).toISOString());
    if (mustChange) {
      sessionStorage.setItem('auth.mustChangePassword', '1');
    }
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  };

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('sends an anonymous caller to the login page, remembering the page asked for', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);

    const result = run('/admin/posts') as UrlTree;

    expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Fadmin%2Fposts');
  });

  it('lets a signed-in person through', () => {
    signIn(false);

    expect(run('/admin/posts')).toBe(true);
  });

  it('holds a person who must change their password to the profile page, remembering where they were going', () => {
    signIn(true);

    const result = run('/admin/posts') as UrlTree;

    expect(router.serializeUrl(result)).toBe('/profile');
    expect(TestBed.inject(AuthService).takeReturnUrl()).toBe('/admin/posts');
  });

  it('lets that person reach the profile page itself', () => {
    signIn(true);

    expect(run('/profile')).toBe(true);
  });

  it('remembers across a page reload that the password must be changed, and forgets it once changed or signed out', () => {
    signIn(true);
    const auth = TestBed.inject(AuthService);

    expect(auth.mustChangePassword()).toBe(true);
    auth.logout();
    expect(auth.mustChangePassword()).toBe(false);
    expect(sessionStorage.getItem('auth.mustChangePassword')).toBeNull();
  });
});
