import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { ClientErrorHandler } from './services/client-error-handler';
import { correlationInterceptor } from './interceptors/correlation.interceptor';
import { serverErrorInterceptor } from './interceptors/server-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([correlationInterceptor, authInterceptor, serverErrorInterceptor])),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: ClientErrorHandler },
  ]
};
