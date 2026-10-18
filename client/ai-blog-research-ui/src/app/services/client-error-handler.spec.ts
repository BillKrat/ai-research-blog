import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ClientErrorHandler, describe as describeError } from './client-error-handler';

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

  it('describes strings and objects too', () => {
    expect(describeError('boom').message).toBe('boom');
    expect(describeError({ a: 1 }).message).toBe('{"a":1}');
  });
});
