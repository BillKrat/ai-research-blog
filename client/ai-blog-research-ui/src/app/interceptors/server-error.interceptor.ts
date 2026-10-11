import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AdminExceptionsService } from '../services/admin-exceptions.service';

/**
 * After any 5xx the server has logged a new exception, so ask for the count again right away instead of waiting for the
 * next poll: an administrator then sees the warning appear as it happens. The exceptions endpoints themselves are left
 * out, so a failing count request cannot trigger itself.
 */
export const serverErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const exceptions = inject(AdminExceptionsService);

  return next(req).pipe(
    tap({
      error: (error) => {
        if (error instanceof HttpErrorResponse && error.status >= 500 && !req.url.includes('/api/admin/exceptions')) {
          exceptions.refresh();
        }
      },
    }),
  );
};
