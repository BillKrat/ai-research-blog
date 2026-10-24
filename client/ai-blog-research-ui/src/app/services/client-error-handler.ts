// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient } from '@angular/common/http';
import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiProblemService } from './api-problem.service';

/**
 * Angular's last-resort handler for an error nobody caught. It still writes to the console (what the default does), and
 * now also reports the error to the server so it reaches the exception log - no silent errors. A failure to report is
 * only written to the console: reporting must never raise another error. The server accepts reports from anonymous callers too
 * (the login page can fail before anyone is signed in), within its own caps.
 */
@Injectable()
export class ClientErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);
  private reporting = false;

  handleError(error: unknown): void {
    console.error(error);
    try {
      this.injector.get(ApiProblemService).reportScript(describe(error).message);
    } catch {
      // showing the error must never raise another
    }
    if (this.reporting) {
      return;
    }

    this.reporting = true;
    try {
      const { message, stack } = describe(error);
      this.injector
        .get(HttpClient)
        .post(`${environment.apiUrl}/api/client-errors`, { message, stack, url: window.location.pathname })
        .subscribe({
          next: () => (this.reporting = false),
          error: () => (this.reporting = false),
        });
    } catch {
      this.reporting = false;
    }
  }
}

/** Pulls a message and stack out of whatever was thrown (an Error, a string, anything). */
export function describe(error: unknown): { message: string; stack: string | undefined } {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`, stack: error.stack };
  }
  return { message: typeof error === 'string' ? error : JSON.stringify(error) ?? 'Unknown error', stack: undefined };
}
