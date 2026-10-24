import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { describeApiError } from '../models/api-error';

/** What the API said when it could not start: the title and, in Development, each missing setting with its fix. */
interface StartupProblemBody {
  title?: string;
  problems?: { key: string; message: string; fix: string }[];
}

/**
 * The one place a failure of the API itself (not a validation message for a form) is kept for the whole page: the banner at
 * the top shows it, whoever is looking, until it is dismissed or the API answers again. Fed by the HTTP interceptor and
 * by the last-resort error handler, so nothing fails silently on the page.
 */
@Injectable({ providedIn: 'root' })
export class ApiProblemService {
  /** The sentences to show, empty when everything is fine. */
  readonly messages = signal<string[]>([]);

  /** Records an HTTP failure when it is the API's own (unreachable or a 5xx). Anything else is left to the screen that asked. */
  reportHttp(error: unknown): void {
    if (!(error instanceof HttpErrorResponse) || (error.status !== 0 && error.status < 500)) {
      return;
    }

    const body = error.error as StartupProblemBody | null;
    if (error.status === 503 && body && typeof body === 'object' && Array.isArray(body.problems)) {
      const lines = body.problems.map((p) => `${p.key}: ${p.message} ${p.fix}`);
      this.messages.set([body.title ?? 'The API could not start.', ...lines]);
      return;
    }

    if (error.status === 0) {
      this.messages.set([
        "The API isn't answering. If you started it yourself, look at the webapi resource's console or its logs/startup-*.log for the reason.",
      ]);
      return;
    }

    this.messages.set(describeApiError(error));
  }

  /** Records something that went wrong in the page itself. */
  reportScript(message: string): void {
    this.messages.set([`Something went wrong in the page: ${message}. It has been reported.`]);
  }

  /** The API answered: whatever was shown before no longer holds. */
  clear(): void {
    if (this.messages().length > 0) {
      this.messages.set([]);
    }
  }
}
