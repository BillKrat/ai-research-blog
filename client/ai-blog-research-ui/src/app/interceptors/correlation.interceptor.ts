import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const correlationHeader = 'X-Correlation-Id';

/** A new id for one request: 32 hex characters, the same shape the server mints, so the two are indistinguishable in the logs. */
export function newCorrelationId(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

/**
 * Gives every request to our API its own correlation id. The server puts that id on every log line and exception
 * record the request produces and echoes it back, so anything a user sees go wrong can be traced to its logs from the
 * id alone. Requests that already carry one are left alone; other sites are never sent it.
 */
export const correlationInterceptor: HttpInterceptorFn = (req, next) => {
  // apiUrl is '' in development (same origin, proxied), where our requests are the relative ones.
  const isOurApi = environment.apiUrl ? req.url.startsWith(environment.apiUrl) : req.url.startsWith('/');
  if (!isOurApi || req.headers.has(correlationHeader)) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [correlationHeader]: newCorrelationId() } }));
};
