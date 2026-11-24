// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ClientErrorHandler, RELOAD_PAGE, describe as describeError, isChunkLoadFailure } from './client-error-handler';

describe('ClientErrorHandler', () => {
  let handler: ClientErrorHandler;
  let controller: HttpTestingController;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [ClientErrorHandler, provideHttpClient(), provideHttpClientTesting()],
    });
    handler = TestBed.inject(ClientErrorHandler);
    controller = TestBed.inject(HttpTestingController);
  });

  it('reports an uncaught error to the server', () => {
    handler.handleError(new TypeError('x is undefined'));

    const request = controller.expectOne((r) => r.url.endsWith('/api/client-errors'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body.message).toBe('TypeError: x is undefined');
    request.flush({});
  });

  it('does not report again while a report is in flight, and survives a failed report', () => {
    handler.handleError(new Error('first'));
    handler.handleError(new Error('second'));

    const request = controller.expectOne((r) => r.url.endsWith('/api/client-errors'));
    request.flush('nope', { status: 401, statusText: 'Unauthorized' });
    expect(() => handler.handleError(new Error('third'))).not.toThrow();
    controller.expectOne((r) => r.url.endsWith('/api/client-errors')).flush({});
  });

  describe('a chunk that cannot be loaded (a tab left open across a deploy, or the host briefly answering 404)', () => {
    let reload: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      sessionStorage.clear();
      reload = vi.fn();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [ClientErrorHandler, provideHttpClient(), provideHttpClientTesting(), { provide: RELOAD_PAGE, useValue: reload }],
      });
      handler = TestBed.inject(ClientErrorHandler);
      controller = TestBed.inject(HttpTestingController);
    });

    afterEach(() => vi.useRealTimers());

    it.each([
      'TypeError: Failed to fetch dynamically imported module: https://www.global-webnet.com/chunk-AbC.js',
      'TypeError: Importing a module script failed.',
      'TypeError: error loading dynamically imported module',
      "TypeError: 'text/html' is not a valid JavaScript MIME type for module script 'x'.",
    ])('is recognised: %s', (message) => {
      expect(isChunkLoadFailure(new TypeError(message.replace('TypeError: ', '')))).toBe(true);
    });

    it('does not mistake an ordinary error for one', () => {
      expect(isChunkLoadFailure(new TypeError('x is undefined'))).toBe(false);
      expect(isChunkLoadFailure('boom')).toBe(false);
    });

    it('is still reported to the server, then the page reloads once', () => {
      handler.handleError(new TypeError('Failed to fetch dynamically imported module: https://x/chunk-A.js'));

      controller.expectOne((r) => r.url.endsWith('/api/client-errors')).flush({});
      expect(reload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does not reload again within a minute (a really broken deploy must not loop)', () => {
      handler.handleError(new TypeError('Importing a module script failed.'));
      controller.expectOne((r) => r.url.endsWith('/api/client-errors')).flush({});
      vi.advanceTimersByTime(2000);
      expect(reload).toHaveBeenCalledTimes(1);

      handler.handleError(new TypeError('Importing a module script failed.'));
      controller.expectOne((r) => r.url.endsWith('/api/client-errors')).flush({});
      vi.advanceTimersByTime(2000);
      expect(reload).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(61_000);
      handler.handleError(new TypeError('Importing a module script failed.'));
      controller.expectOne((r) => r.url.endsWith('/api/client-errors')).flush({});
      vi.advanceTimersByTime(2000);
      expect(reload).toHaveBeenCalledTimes(2);
    });

    it('never reloads for an ordinary error', () => {
      handler.handleError(new Error('something else'));
      controller.expectOne((r) => r.url.endsWith('/api/client-errors')).flush({});
      vi.advanceTimersByTime(5000);
      expect(reload).not.toHaveBeenCalled();
    });
  });

  it('describes strings and objects too', () => {
    expect(describeError('boom').message).toBe('boom');
    expect(describeError({ a: 1 }).message).toBe('{"a":1}');
  });
});
