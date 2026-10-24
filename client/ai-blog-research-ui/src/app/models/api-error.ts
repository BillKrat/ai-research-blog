// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns whatever the API answered into sentences a person can act on. The server decides what is said (the Bll writes
 * the user-friendly text: "The DOB field is not in the right format..."); this only picks it out of the response shape:
 *
 * - 400 with field errors: every message, each already naming its field;
 * - 409: the business rule's own message;
 * - 500: the shielded title plus the reference of the exception-log entry, so an administrator can find it;
 * - anything else: a generic line (never the raw status text, which means nothing to a user).
 */
export function describeApiError(error: unknown, fallback = 'Something went wrong. Try again.'): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [fallback];
  }

  const body = error.error;

  switch (error.status) {
    case 0:
      return ["Couldn't reach the server. Check your connection and try again."];

    case 400: {
      const fieldErrors = body && typeof body === 'object' ? (body as { errors?: Record<string, string[]> }).errors : undefined;
      const messages = fieldErrors ? Object.values(fieldErrors).flat().filter(Boolean) : [];
      if (messages.length > 0) {
        return messages;
      }

      // a problem the server worded itself (for example a refused upload) carries its sentence in the title
      const title = body && typeof body === 'object' ? (body as { title?: unknown }).title : undefined;
      return [typeof title === 'string' && title.length > 0 ? title : fallback];
    }

    case 401:
      return ['Your session has ended. Sign in again.'];

    case 403:
      return ["You don't have permission to do that."];

    case 409:
      return [typeof body === 'string' && body ? body : fallback];

    default: {
      if (error.status >= 500) {
        const problem =
          body && typeof body === 'object'
            ? (body as { title?: string; errorId?: string | null; correlationId?: string | null })
            : undefined;
        const title = problem?.title ?? 'Something went wrong on the server. It has been logged.';
        // The trace id finds every log line of the request, even when the exception itself could not be stored.
        const traceId = problem?.correlationId ?? error.headers?.get('X-Correlation-Id');
        const reference = problem?.errorId ? ` Reference: ${problem.errorId}.` : '';
        const trace = traceId ? ` Trace: ${traceId}.` : '';
        return [`${title}${reference}${trace}`];
      }
      return [fallback];
    }
  }
}
