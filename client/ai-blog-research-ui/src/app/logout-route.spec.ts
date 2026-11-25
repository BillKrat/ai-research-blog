import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '@adventures/core';
import { logOffGuard, routes } from './app.routes';

/** The Administration widget's "Log off" link is a plain address, /logout: opening it signs the person out and shows the home page. */
describe('the /logout address', () => {
  it('is a route', () => {
    expect(routes.find((r) => r.path === 'logout')).toBeDefined();
  });

  it('signs out and sends the person to the home page', () => {
    const logout = vi.fn();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { logout } }] });

    const result = TestBed.runInInjectionContext(() => logOffGuard({} as never, {} as never));

    expect(logout).toHaveBeenCalledOnce();
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
