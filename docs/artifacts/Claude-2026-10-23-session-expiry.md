# Stage review: an expired sign-in sends you to the login page (2026-10-23)

Branch `claude-session-expiry` (client only). Found by the human while testing the image upload: after the sign-in expired, clicks did nothing until a refresh.

**Cause:** the token lives in sessionStorage with a fixed expiry and no refresh. The route guard only checks it when navigating to a route, so a page already open kept sending a dead token; the server answered 401 and nothing reacted.

**Change:** the auth interceptor treats a 401 on a request that carried the token (other than signing in itself) as an expired sign-in: it drops the stored sign-in and navigates to `/login?expired=1&returnUrl=<page>`. The login page shows "Your session has expired. Sign in again to carry on where you were." and, after signing in, returns to that page (only a path inside the app; `//` and `/login` are ignored). The route guard also remembers the page it was asked for. A 403 and a 401 from the sign-in call are left alone.

```mermaid
flowchart LR
  A[Click in an open page] --> B[API call with the old token]
  B -->|401| C[Interceptor drops the sign-in]
  C --> D[/login?expired=1&returnUrl=page]
  D --> E[Sign in]
  E --> F[Back on the same page]
```

**Verified:** 4 new interceptor tests (token sent; 401 redirects and clears; sign-in 401 untouched; 403 untouched), client 83 passing, production build.
**Not verified:** the real expiry in a browser (set `auth.expiresAtUtc`/wait for the token life, then click). Test steps are in the review post.
