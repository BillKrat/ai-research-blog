# Stage review: the web site's rules ship with the client (2026-11-27)

## Why

The live `global` web site still held an old BlogEngine install, and its 20 KB `Web.Config` was the only thing that made the Angular
client work there (deep links). The client deploy never shipped a `web.config`, so emptying the folder would have broken every refresh on
a deep link. The rules now live in the repository and travel with every build.

## What was built

- `client/ai-blog-research-ui/public/web.config`: the whole configuration of a static IIS web site, no application settings or secrets.
- `client/ai-blog-research-ui/src/app/web-config.spec.ts`: 31 tests, written first, that evaluate the rewrite rules and pin the settings.
- `.github/workflows/deploy-single.yml`: removes the file, because there the API serves the client and has its own `web.config`.
- Workspace `docs/Claude-verify.ps1`: two new checks (the page is not cached; plain http redirects to https).

```mermaid
flowchart TD
  R[Request to the web site] --> W{path under .well-known?}
  W -- yes --> S[Serve as the host's own challenge settings say]
  W -- no --> H{plain http on a real domain, not already https at a proxy?}
  H -- yes --> T[301 to https, same path and query]
  H -- no --> F{file exists?}
  F -- yes --> V[Serve it, Cache-Control no-cache]
  F -- no --> A{script, style, map or font?}
  A -- yes --> N[404]
  A -- no --> I[Serve index.html: the Angular router takes over]
```

## Decisions I took

- **https redirect:** applies to every address except `localhost`, `127.0.0.1` and the `*.atempurl.com`, `*.dtempurl.com` and
  `*.ftempurl.com` temporary addresses. An installation on a real domain needs its certificate first (install guide).
- **Threats the headers address:** content sniffing (`nosniff`), clickjacking (`X-Frame-Options: SAMEORIGIN`), address leaking to other
  sites (`Referrer-Policy`), unused device features (`Permissions-Policy`). No Content-Security-Policy: it needs its own tested stage.
- **No Strict-Transport-Security** on the web site: browsers hold it for months, so it should be a deliberate choice.
- **Caching:** every file is revalidated. Simple and never stale; long caching of the hashed files can come later.
- **Missing assets are a 404** instead of the application page, which is what the old site did.

## Verified

- Client tests: all projects pass, including the 31 new ones (they failed before the file existed). Production build copies the file
  beside `index.html`.
- Server test projects that the CI runs: pass.
- IIS Express with URL Rewrite, the built client, and the host's real `.well-known/acme-challenge/web.config`: deep links 200 with the
  application page (also `.aspx` and dotted addresses), `no-cache` and the four headers present, `about.md` served as Markdown, missing
  assets 404, `/web.config` 404, the challenge file 200 over plain http, the redirect keeps path and query, no redirect when a proxy says
  https.

## Deployed (2026-11-27)

- The human emptied `global` in the host panel; the push to `main` ran the Angular deploy, which uploaded only the client.
- `Claude-verify.ps1` passes every check in PowerShell 7 and Windows PowerShell 5.1. By request: deep links and old `.aspx` addresses
  answer the application page, files are sent `no-cache` with the four headers, plain http redirects (path and query kept), a missing
  asset and `/web.config` are 404. Certificates for the bare and `www` names are valid to 2027-02-21.

## Not verified

- A certificate renewal. `.well-known` was deleted with the rest; its files dated from the two certificate requests, so the host
  most likely writes them again at renewal. A copy of its challenge `web.config` is kept outside the repositories.
- No browser click-through of the signed-in screens after this deploy (the client code is unchanged).
