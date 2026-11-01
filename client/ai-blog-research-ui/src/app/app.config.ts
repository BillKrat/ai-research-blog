// Assessed 2026-10-24 17:37 CT (Claude): automated scan for secrets, injection and unsafe patterns - no finding in this file. See docs/artifacts/Claude-2026-10-24-security-practices-patterns-review.md (ai-research-blog).
import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';
import { API_BASE_URL, apiProblemInterceptor, authInterceptor, ClientErrorHandler, correlationInterceptor, timeoutInterceptor } from '@adventures/core';
import { environment } from '../environments/environment';
import { serverErrorInterceptor } from '@adventures/admin';

export const appConfig: ApplicationConfig = {
  providers: [
    // the one place the app's own environment file is read: everything below gets the address by injection
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([correlationInterceptor, authInterceptor, serverErrorInterceptor, apiProblemInterceptor, timeoutInterceptor])),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: ClientErrorHandler },
    provideMarkdown(),
  ]
};
