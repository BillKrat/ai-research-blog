// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Redirects to /login (remembering the page asked for) rather than rendering a route that needs an authenticated caller. A person who must change
 * their password first is held to the profile page (remembering where they were going); the server refuses everything else for them anyway.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (authService.mustChangePassword() && !state.url.startsWith('/profile')) {
    authService.rememberReturnUrl(state.url);
    return router.createUrlTree(['/profile']);
  }

  return true;
};
