// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { HttpClient } from '@angular/common/http';
import { ErrorHandler, Injectable, InjectionToken, Injector, inject } from '@angular/core';
import { API_BASE_URL } from '../api-base-url';
import { ApiProblemService } from './api-problem.service';

/** Reloads the page; an injection token so a test can replace it. */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  providedIn: 'root',
  factory: () => () => window.location.reload(),
});

const CHUNK_RELOAD_KEY = 'adv.chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 60_000;
const CHUNK_RELOAD_DELAY_MS = 1500;

/**
 * True when the browser could not load a lazy chunk: the wording differs by browser (Chrome, Firefox, Safari) and a host that
 * answers an error page for the file gives the MIME type form. Usual causes are a tab left open across a deploy (the old chunk
 * names are gone) or the host briefly answering 404.
 */
export function isChunkLoadFailure(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === 'string' ? error : '';
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|is not a valid JavaScript MIME type/i.test(text);
}

/** True at most once a minute per browser tab, so a really broken deploy cannot send the page into a reload loop. */
function mayReloadForChunk(now: number): boolean {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (now - last < CHUNK_RELOAD_WINDOW_MS) {
      return false;
    }

    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false; // no storage, no guard against a loop, so no reload
  }
}

/**
 * Angular's last-resort handler for an error nobody caught. It still writes to the console (what the default does), and
 * now also reports the error to the server so it reaches the exception log - no silent errors. A failure to report is
 * only written to the console: reporting must never raise another error. The server accepts reports from anonymous callers too
 * (the login page can fail before anyone is signed in), within its own caps.
 */
@Injectable()
export class ClientErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly reloadPage = inject(RELOAD_PAGE);
  private reporting = false;

  handleError(error: unknown): void {
    console.error(error);
    if (isChunkLoadFailure(error) && mayReloadForChunk(Date.now())) {
      // still reported below (no silent errors); the short delay lets the report leave before the page goes
      setTimeout(this.reloadPage, CHUNK_RELOAD_DELAY_MS);
    }

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
        .post(`${this.apiUrl}/api/client-errors`, { message, stack, url: window.location.pathname })
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
