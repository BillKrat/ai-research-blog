// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { ClientErrorHandler } from './services/client-error-handler';
import { correlationInterceptor } from './interceptors/correlation.interceptor';
import { serverErrorInterceptor } from './interceptors/server-error.interceptor';
import { apiProblemInterceptor } from './interceptors/api-problem.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([correlationInterceptor, authInterceptor, serverErrorInterceptor, apiProblemInterceptor])),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: ClientErrorHandler },
    provideMarkdown(),
  ]
};
