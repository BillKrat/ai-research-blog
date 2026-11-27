# Schema browser: try it locally, then install it

Owner: Claude. The applications are in `Adventures.Foundation/apps` ([decision](Claude-decision-2026-11-foundation-apps.md)). Placeholders: `<browser-site>` (web client), `<browser-api-site>` (browser API), `<domain-name>` (a site you browse). Written 2026-11-27; **nothing has been deployed**, so the install steps are untried.

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

**Order.** Foundation merges to `main` before the blog app. A change only in Foundation does not trigger the app's deploy workflows: dispatch the API deploy by hand.

**Before uploading anything:** the two intended sites already exist on the host. On 2026-11-27 each web root held only a placeholder `index.html` (a read-only listing); look again before an upload, since uploading replaces what is there. Their pool settings, FTP users and upload folders still have to be set up (`Claude-ftp-tree.ps1` in the private workspace uploads a published folder to a fresh site).

1. **Each domain's API:** deploy the new version, then set `Browser__Enabled` = `true` in that site's application pool and restart it. On its first start the Developer role gains `schema.read`, only where its rights are still the shipped default.
2. **Browser API on `<browser-api-site>`:** `dotnet publish apps/Adventures.Browser.Host -c Release -o <folder>`; upload the folder; set in its pool:
   - `BrowserGateway__Sites__0__Domain` = `<domain-name>` and `BrowserGateway__Sites__0__Api` = that domain's API address (`__1__` for the next one)
   - `BrowserGateway__AllowedOrigins__0` = `https://<browser-site>`
   - Check: `https://<browser-api-site>/api/health` says Healthy; `https://<browser-api-site>/api/sites` is 404.
3. **Web app on `<browser-site>`:** `dotnet publish apps/Adventures.Browser.Web -c Release -o <folder>`; in `<folder>\wwwroot\appsettings.json` set `Api:BaseUrl` to `https://<browser-api-site>/` and delete `appsettings.json.br` and `.gz` beside it; upload the folder. The published `web.config` needs the IIS URL Rewrite module.
4. **Desktop:** put the address in `%LOCALAPPDATA%\Adventures.Browser\settings.json` as `{ "apiBaseUrl": "https://<browser-api-site>/", "domains": [] }`.

## Limits to know

- A domain sees every sign-in as coming from the browser API's address, so its own sign-in limit is shared by all browser visitors. The browser API limits each visitor itself.
- Passwords pass through the browser API: treat that site as trusted as the domains.
- Domains on one database show the same schemas.
- Read only. Data browsing, relations as data, and changing a password from the applications are later work.
