import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { ActingTenantService } from '../services/acting-tenant.service';
import { AuthService } from '../services/auth.service';

/** The title the server gives when this person may not act in the chosen tenant (see ActingTenantMiddleware). */
export const ACTING_TENANT_REFUSED = 'You cannot act in that tenant.';

/**
 * Sends the chosen tenant (the tenant switcher) as X-Acting-Tenant on calls to the API made while signed in. The server checks it every time. When it
 * refuses the choice (the person left that tenant, or a different person signed in on this browser) the choice is dropped and the page reloads into the
 * tenant the address names, instead of every screen failing.
 */
export const actingTenantInterceptor: HttpInterceptorFn = (req, next) => {
  const acting = inject(ActingTenantService);
  const id = acting.id();
  const apiUrl = inject(API_BASE_URL);
  const isApi = apiUrl ? req.url.startsWith(apiUrl) : req.url.startsWith('/');
  if (!id || !isApi || !inject(AuthService).accessToken()) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'X-Acting-Tenant': id } })).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 403 && (error.error as { title?: string } | null)?.title === ACTING_TENANT_REFUSED) {
        acting.choose(null);
        acting.reload();
      }
      return throwError(() => error);
    }),
  );
};
