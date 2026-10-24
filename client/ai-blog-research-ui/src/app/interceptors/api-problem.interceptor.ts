// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { ApiProblemService } from '../services/api-problem.service';

/**
 * Shows an API that is down, misconfigured or failing (status 0 or 5xx) in the banner at the top of every page, and takes
 * the banner away again as soon as an API call succeeds. The client-error report is left out so a failing report cannot
 * raise a banner about itself.
 */
export const apiProblemInterceptor: HttpInterceptorFn = (req, next) => {
  const problems = inject(ApiProblemService);
  const watched = req.url.includes('/api/') && !req.url.includes('/api/client-errors');

  return next(req).pipe(
    tap({
      next: (event) => {
        if (watched && event.type === HttpEventType.Response) {
          problems.clear();
        }
      },
      error: (error) => {
        if (watched && error instanceof HttpErrorResponse) {
          problems.reportHttp(error);
        }
      },
    }),
  );
};
