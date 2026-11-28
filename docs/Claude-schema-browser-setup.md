# Schema browser: try it locally, then install it

Owner: Claude. The applications are in `Adventures.Foundation/apps` ([decision](Claude-decision-2026-11-foundation-apps.md)). Placeholders: `<browser-site>` (web client), `<browser-api-site>` (browser API), `<domain-name>` (a site you browse). Written 2026-11-27, install steps revised 2026-11-28; **nothing has been deployed**, so the steps are untried on the host.

## The pieces

| Piece | Project | What it needs |
|---|---|---|
| Each domain's API | any host built on `Adventures.Hosting` | `Browser__Enabled=true`; the person holds `schema.read` there (administrators already do; the Developer role gets it at start) |
| Browser API | `apps/Adventures.Browser.Host` | The list of domains it may call. No database, no users, no secrets |
| Desktop app | `apps/Adventures.Browser.Desktop` (Windows) | The browser API address |
| Web app | `apps/Adventures.Browser.Web` (static files) | The browser API address |

## Try it on one computer

Three terminals, in `M:\Dev\repos`. The domain here is `localhost`: your local blog API with the browser switched on. Sign in with an account on that local system that has finished its first password change.

1. The domain (the blog API, https on 7052):

```powershell
$env:Browser__Enabled='true'; dotnet run --project ai-research-blog\src\AiBlogResearch.WebApi --launch-profile https
```

2. The browser API (https on 59433; in Development it already lists `localhost`):

```powershell
dotnet run --project Adventures.Foundation\apps\Adventures.Browser.Host
```

3. The desktop app, or the web app:

```powershell
dotnet run --project Adventures.Foundation\apps\Adventures.Browser.Desktop
```

```powershell
dotnet run --project Adventures.Foundation\apps\Adventures.Browser.Web
```

Add the domain `localhost`, sign in, pick a schema, follow a link under "Points at" or "Used by", go back, filter, switch domains, sign out.

## What to test (the regression list)

1. A wrong password says refused, and does not say which part was wrong.
2. A domain the browser API does not list answers the same way.
3. An account without `schema.read` is told it needs it.
4. An account that must change its password is told to do that on the site.
5. After the session lapses, the next click returns to sign-in with a reason.
6. Two domains: each keeps its own session; signing out of one leaves the other.
7. Close and reopen: the domain list is still there; you must sign in again.
8. Web app on a phone-width window; light and dark.

## Install (needs your word before any upload)

**Order.** The two browser sites can be uploaded before any domain is ready; browsing a domain works once that domain runs the new API. Foundation merges to `main` before the blog app. A change only in Foundation does not trigger the app's deploy workflows: dispatch the API deploy by hand.

**Before uploading anything:** the two intended sites already exist on the host. On 2026-11-28 each web root held only a placeholder `index.html` (a read-only listing); look again before an upload, since uploading replaces what is there. Each needs an FTP user rooted at its own folder (`Claude-ftp-tree.ps1` in the private workspace uploads a published folder to a fresh site, dry run first).

**Shared pool.** The two sites sit in a pool with other sites, none of the ones that could be listed being an ASP.NET Core application. The host's `web.config` runs it out of process. IIS cannot mix the two hosting models in one pool (500.34) and runs only one in-process application per pool (500.35), so any later ASP.NET Core site in that pool must run out of process too.

1. **Each domain's API:** deploy the new version, then set `Browser__Enabled` = `true` in that site's application pool and restart it. On its first start the Developer role gains `schema.read`, only where its rights are still the shipped default.
2. **Browser API for `<browser-api-site>`:** `dotnet publish apps/Adventures.Browser.Host -c Release -p:UseAppHost=false -o <folder>`; delete `appsettings.Development.json`; add `appsettings.Production.json` to the folder (never committed; the application does not serve it). This keeps the settings with the site rather than in a pool other sites share; pool variables (`BrowserGateway__Sites__0__Domain` and so on) work too.

   ```json
   { "BrowserGateway": {
       "Sites": [ { "Domain": "<domain-name>", "Api": "https://<that domain's API>/" } ],
       "AllowedOrigins": [ "https://<browser-site>" ] } }
   ```

   Upload, then check: `/api/health` says Healthy; `/api/sites` and `/appsettings.Production.json` are 404; a plain `http://` request to `/api/health` is refused or redirected.
3. **Web app for `<browser-site>`:** `dotnet publish apps/Adventures.Browser.Web -c Release -o <folder>`; in `<folder>\wwwroot\appsettings.json` set `Api:BaseUrl` to `https://<browser-api-site>/` and delete `appsettings.json.br` and `.gz` beside it if present; upload the folder. The published `web.config` needs the IIS URL Rewrite module.
4. **Desktop:** `dotnet publish apps/Adventures.Browser.Desktop -c Release -o <folder>`; set `Api:BaseUrl` in `<folder>\appsettings.json` (a person's own `%LOCALAPPDATA%\Adventures.Browser\settings.json` overrides it). Needs the .NET 10 desktop runtime.

**Tried on 2026-11-28 with the published builds under local IIS Express** (a stand-in domain, not the host): web start page, deep link, settings file, https redirect, file types and headers; browser API health, cross-origin rules, refusals and hidden settings files; add a domain, sign in, list and open a schema in the web app with no console errors; the desktop app starts and closes. Nothing has been uploaded.

## Limits to know

- A domain sees every sign-in as coming from the browser API's address, so its own sign-in limit is shared by all browser visitors. The browser API limits each visitor itself.
- Passwords pass through the browser API: treat that site as trusted as the domains.
- Domains on one database show the same schemas.
- Read only. Data browsing, relations as data, and changing a password from the applications are later work.
