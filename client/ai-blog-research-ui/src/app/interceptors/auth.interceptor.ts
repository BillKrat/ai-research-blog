import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Attaches the current JWT (if any) as a Bearer token on outgoing requests. When the server answers 401 to a request that carried
 * the token, the sign-in has expired (or was revoked): the stored sign-in is dropped and the person is sent to /login with a note
 * and the page they were on, instead of a page whose clicks silently do nothing. Signing in itself (a 401 there means wrong
 * credentials) is left alone.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.accessToken();

  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.includes('/api/auth/token')) {
        const returnUrl = router.url;
        authService.logout();
        if (!returnUrl.startsWith('/login')) {
          void router.navigate(['/login'], { queryParams: { expired: 1, returnUrl } });
        }
      }
      return throwError(() => error);
    }),
  );
};
