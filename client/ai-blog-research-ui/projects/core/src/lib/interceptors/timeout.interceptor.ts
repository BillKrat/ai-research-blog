import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

/** How long a request to our API may go unanswered, in milliseconds; 0 turns the limit off. The host may provide another value. */
export const API_TIMEOUT_MS = new InjectionToken<number>('API_TIMEOUT_MS', { providedIn: 'root', factory: () => 15_000 });

/** A request that legitimately takes longer (an AI triage, a file upload) says so here; 0 means "use the default". */
export const REQUEST_TIMEOUT_MS = new HttpContextToken<number>(() => 0);

/**
 * Ends a request to our API that is never answered. A server that accepts the connection and then says nothing (a stopped API behind a proxy, a hung app
 * pool) otherwise leaves a screen on "Loading..." for good. The limit becomes the same failure as an unreachable API (status 0, statusText "Timeout"), so the
 * problem banner, the health badge and each screen's own error line react exactly as they do for a refused connection. Other sites are left alone.
 * Register it last, so what it raises passes through the other interceptors like any server failure.
 */
export const timeoutInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(API_BASE_URL);
  const limit = req.context.get(REQUEST_TIMEOUT_MS) || inject(API_TIMEOUT_MS);
  const isOurApi = apiUrl ? req.url.startsWith(apiUrl) : req.url.startsWith('/');
  if (!isOurApi || limit <= 0) {
    return next(req);
  }

  return next(req).pipe(
    timeout({ each: limit }),
    catchError((error: unknown) =>
      error instanceof TimeoutError
        ? throwError(() => new HttpErrorResponse({ url: req.url, status: 0, statusText: 'Timeout', error: new ProgressEvent('timeout') }))
        : throwError(() => error),
    ),
  );
};
