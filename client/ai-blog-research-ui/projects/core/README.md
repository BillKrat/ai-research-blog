# @adventures/core

The part of an Adventures client that has no screens: what any Angular app talking to an Adventures API needs.

- **`API_BASE_URL`**: where the API lives (empty means the page's own origin). The host provides it once; nothing here reads an environment file.
- **Contract models**: `EntityGridModel`, `EntityFormModel`, `EntityDataModel` and the API error shape (the same grid and form contract the .NET `Adventures.Entities` project serves).
- **Services**: `AuthService` (token sign-in, rights), `EntityApiService` (one thin client for every collection), `MediaService`, `ApiProblemService` and the last-resort `ClientErrorHandler`.
- **Interceptors and guard**: `correlationInterceptor`, `authInterceptor`, `apiProblemInterceptor`, `authGuard`.

```ts
// app.config.ts
providers: [
  { provide: API_BASE_URL, useValue: 'https://api.example.com' },
  provideHttpClient(withInterceptors([correlationInterceptor, authInterceptor, apiProblemInterceptor])),
  { provide: ErrorHandler, useClass: ClientErrorHandler },
]
```

Rules: no component, nothing feature-specific, and no import of the host app (the package build enforces it). Build with `ng build core`; tests run with `ng test core`.
