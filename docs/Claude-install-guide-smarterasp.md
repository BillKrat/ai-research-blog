# Install guide: your own copy on SmarterASP.NET (draft)

**Status: draft written from how our own sites were built. Not yet proved on a fresh installation.** Every step marked *(ours)* is one we did on our own sites; *(unproved)* means we have not repeated it from scratch. The proof run uses a spare domain, written here as `<domain-name>`, and turns this draft into the real guide. For the cheap-hosting background see [Claude-developer-setup-guide.md](Claude-developer-setup-guide.md).

**Two ways to install (decided 2026-11-22, onboarding):**
- **Evaluate on one address (easiest, no domain needed):** one SmarterASP site, the API serves the client, its temporary address is the whole app. Go straight to "One site, one address" near the end of this guide; stages 7 to 9 below are for the production layout.
- **Production layout (what this project itself runs):** three sites and a domain, described next.

**What you end up with (production layout):** three sites on one hosting account, `www.<domain-name>` (the Angular client), `api.<domain-name>` (the API) and `mcp.<domain-name>` (the MCP server), a PostgreSQL database, free HTTPS certificates, and GitHub Actions that test and then deploy on every merge to `main`. Running cost: about $38 a quarter for hosting plus an AI subscription if you use one.

## 0. Before you start
- A SmarterASP.NET account with a plan that includes PostgreSQL, a registered domain name `<domain-name>` whose DNS you control, a GitHub account.
- Locally: .NET 10 SDK, Node.js, Git. (For local running: PostgreSQL 17, see [Claude-local-database.md](Claude-local-database.md).)
- Fork **both** repositories: `ai-research-blog` and `Adventures.Foundation`. The workflows build the app against a sibling checkout of Foundation.

## 1. Sites and DNS *(ours)*
1. In the hosting panel create three sites: `www`, `api`, `mcp`, each with its own folder. Attach `<domain-name>` and `www.<domain-name>` to the client site, `api.<domain-name>` to the API site, `mcp.<domain-name>` to the MCP site. Our experience: the MCP site had to be a **subsite** to get a free certificate.
2. Point the DNS records at the hosting account as the panel shows.
3. Request the free certificate (Let's Encrypt) for each name and wait until the panel shows it installed. Expect: `https://api.<domain-name>/api/health` answers once the API is deployed (step 7).

## 2. Database *(ours)*
1. Create a PostgreSQL database and user in the panel. Note the host, port, database, user (the port may differ from the usual 5432 and may need allowing from your own machine).
2. Build the connection string `Host=<db-host>;Port=<db-port>;Database=<db-name>;Username=<db-user>;Password=<from your password manager>`. Do not put it in any file in the repository.

## 3. FTP users, one per site *(ours)*
Create a scoped FTP user for each site restricted to that site's folder (see the older guide, section 3). The deploy tool's remote folder is `/` for such a user. Keep the account's root login out of GitHub.

## 4. One setting for the domain *(built, unproved on a fresh install)*
Your domain is set in two places, never by editing files:
- **On the API and MCP sites (host secret):** `Site__Domain` = `<domain-name>` (a bare name such as `example.com`; a malformed value is reported by name at startup). It decides the allowed browser origins (`https://<domain-name>`, `https://www.<domain-name>`), the sign-in tenant, and the addresses `https://api.<domain-name>/` and `https://mcp.<domain-name>/`. Without it the older explicit settings apply, which is how our own installation still runs.
- **On GitHub (repository variables, Settings > Secrets and variables > Actions > Variables):** `SITE_DOMAIN` = `<domain-name>` (the client is built to call `https://api.<domain-name>`, and the deploy checks that address's health) and, if you use your own fork of the libraries, `FOUNDATION_REPO` = `<your-account>/Adventures.Foundation`. Without them the workflows use ours.

Still ours to remove by hand if you publish a fork: the example text in `README.md` and the sample hostnames in comments.

## 5. Secrets
**On the host (site environment secrets, then restart the site)** *(ours)*:

| Site | Secret | Value |
|---|---|---|
| api | `ConnectionStrings__Postgres` | the connection string from step 2 |
| api | `Jwt__SigningKey` | a long random value (generate one; never reuse ours) |
| api | `ClientSecret__<ClientId in PascalCase>`, for example `ClientSecret__ClaudeAuthor` | one random secret per machine client you switch on (clients are listed in `appsettings.json`; no secret = the client is inactive). The older `M2MClients__Clients__<n>__Secret` still works |
| api | `Anthropic__ApiKey` | optional; only for "Ask Claude" on exceptions |
| mcp | the same signing and client settings it needs to validate the API's tokens | see the MCP site's settings file |

**Which variable goes where (each site has its own pool; set them in SmarterASP Pool Manager > the pool > Environment Variables, then restart the site).** Names use a double underscore; values are never put in a repository.

| Variable | One-site install (whole app) | api site | mcp site | Note |
|---|---|---|---|---|
| `ConnectionStrings__Postgres` | required | required (same database) | not used | the database the site stores everything in; empty database on a fresh install |
| `Jwt__SigningKey` | required | required | required, **identical** to the api's | a long random value (for example 48 random bytes, base64); tokens the api issues are checked by the mcp site with it |
| `Site__Domain` | recommended | recommended | recommended | your bare domain, for example `example.com`. The shipped `appsettings.json` points at the project's own domain (`McpServer:BaseUrl`, `Api:BaseUrl`, CORS), so without it a site would call the wrong mcp or api; with it, the api and mcp addresses become `https://api.<domain>/` and `https://mcp.<domain>/` and the allowed browser origins follow. Still used for the CORS origins, the addresses between sites and the sign-in fallback when no tenant matches; the tenant of a request itself comes from the host |
| `ClientSecret__ClaudeAuthor` (and `...ClaudeDiagnostics`, `...ClaudeResearch`) | only to let that client in | only to let that client in | not used | one random secret per machine client you switch on; no value, no access |
| `Anthropic__ApiKey` (+ `Anthropic__Model`, `Anthropic__MaxCallsPerHour`) | optional | optional | not used | only for Ask Claude on exceptions |
| `ConnectionStrings__BlogAi` | not used | not used | optional | only for the read-only legacy BlogEngine research tools; leave unset elsewhere |

Nothing else is required: the environment name, the seed profile (an install seed on any non-development host) and the client switch have working defaults.

If the API shows a 503 "reporting app", a required secret is missing and the page names it. If sign-in answers 500, the API cannot reach the database.

**On GitHub (repository secrets):** `FOUNDATION_TOKEN` (only if your Adventures.Foundation fork is private: a fine-grained token with read-only Contents access to that one repository); `SMARTERASP_FTP_SERVER`; `SMARTERASP_FTP_USERNAME` and `SMARTERASP_FTP_PASSWORD` (client site); `SMARTERASP_API_FTP_USERNAME` and `SMARTERASP_API_FTP_PASSWORD`; `SMARTERASP_MCP_FTP_USERNAME` and `SMARTERASP_MCP_FTP_PASSWORD`. Use the scoped users from step 3.

## 6. Run the tests first
Before pushing, run the read-only preflight (see the backlog note at the end) to catch a missing secret, variable or DNS name.

Push a branch: the `Tests` workflow runs the API, MCP and client suites on GitHub. Expect: three green jobs. A deploy only runs after the same tests pass.

## 7. First deploy
Merge to `main` (or run each deploy workflow by hand): MCP, then API, then client. Each API deploy takes the site offline for a moment (`app_offline.htm`) and the workflow then checks the health endpoint. Expect: all three runs green; `https://www.<domain-name>` shows the public site.

## 8. First sign-in and hardening *(ours, learned the hard way)*
1. **A fresh install** (an empty store on a deployed host) makes the first site by itself: the first address that reaches the API becomes the first tenant, its `Admin` account is created with the well-known default password, flagged to be changed, and `Admin` becomes the platform administrator. It carries only the install seed (no sample posts, no Claude account). **Sign in as `Admin` at once and change the password**: the app will not let you do anything else until you do.
   **Record the new `Admin` password in a password manager before you do anything else.** "Forgot my password" on the sign-in page works only when the E-mail settings work and the address on the account has been confirmed (Profile > send the verification mail), so confirm it once the install is up. If it is lost and that is not set up, the person with host access runs the last-resort reset from the workspace tools: `reset-password -Tenant <your domain> -Account Admin` of `Claude-nquad-tool` (a dry run first, then `-Apply` in your own terminal; it prints one new password once and forces a change at the next sign-in). Never edit the database by hand.
2. The first site is made only when the store holds no tenant at all, so a running install can never be taken over this way.
3. **Another address that reaches the API** (a second domain, or a temporary address you bound later) shows a setup page instead of a site. Sign in there with the domain, user name and password of a platform administrator of an existing site (whose default password has already been changed), then either **attach** the address to a site (it becomes an alias, so the same data answers on both) or **start a new site** (its own `Admin` with the default password, changed at its first sign-in). Nothing is ever created for an unknown address without a platform administrator doing it.
4. Create a second administrator before you remove or demote anyone; the app refuses to remove the last one.
5. If you use an AI collaborator, create that account yourself (Admin > Users) with a strong password; no default `Claude` account exists on an install. Create the four named test people from [Claude-test-users.md](Claude-test-users.md) on a test copy, never on real customers' data.

## 9. Check it works
- `https://api.<domain-name>/api/health` answers healthy.
- Anonymous requests to admin addresses are refused (401).
- The home page, a post, a page and a deep link (reload on `/post/<slug>`) all load.
- Our own `docs/Claude-verify.ps1` (workspace root) does this check; adapt its host names.

## 10. Updating later
Merge to `main`; the gate tests, then the three workflows deploy only the part whose files changed. A new seed applies once at startup and cannot change a value already stored; a changed default ships as an upgrade step.

## 11. Known traps
- Writing into `/api-global/api-global/`: the scoped FTP user already starts in its folder.
- Browsers cache `index.html` too long on the client site; see open issue OI-2.
- A deploy that reports success while the app returns 500 (a missing secret): the health check step exists to make that loud.
- Local runs use `https-live` against the **live** store only when you choose that profile; use the normal profile with a local database for experiments.

## What would make this install shorter (backlog)
1. (Done on branch `claude-site-domain`.) The domain is now the single setting `Site__Domain` plus the variables `SITE_DOMAIN` and `FOUNDATION_REPO`.
2. (Done 2026-11-22.) The first sign-in forces the default password to change, and an install has no default `Claude` account.
3. (Built 2026-10-29, `Claude-preflight.ps1` in the workspace root; proved only against our own domain until the proof run.) One script that checks every secret and DNS name before the first deploy: `.docsClaude-preflight.ps1 -Domain <domain-name> -Repo <you>/ai-research-blog -FoundationRepo <you>/Adventures.Foundation`.

## One site, one address: the evaluation path (single-site mode)

The easiest install is ONE SmarterASP site: the API serves the client itself, so the site's own temporary address (`<account>-siteN.dtempurl.com`) is the whole application. Set the repository variable `DEPLOY_MODE` to `single`, put the one site's FTP account in the API FTP secrets, and run the **Deploy single site** workflow. Open the address: on a new database the first visit creates the site and you sign in with `Admin` and `Admin` (you are made to change the password at once). A domain is welcome but not required to evaluate; when you have one, bind it to the same site and attach it as an alias of the tenant (Admin > Tenants), and the same data answers on both addresses. The split layout (a `www` site for the client and an `api.` site for the API) is for production setups like this project's own and is the default when `DEPLOY_MODE` is not set.

## One folder, many domains: each domain its own configuration (single-site mode; proved on a second host 2026-11-25)

The address a visit arrives on decides which tenant (which configuration, content and sign-ins) answers. That is why one set of folders can serve many domains, each with its own configuration.

**Use single-site mode for this, not the split layout.** In the split layout every web site calls ONE API address, and the API picks the tenant from the address it is called on, so two web sites that share an API show the same tenant however each is configured. In single-site mode the API serves the client itself and every domain reaches the same site, so the domain in the browser is the address the API sees: `domain-a.example` reaches tenant A and `domain-b.example` reaches tenant B.

1. **One SmarterASP site holds the app** (the API with the client in its `wwwroot`; the `Deploy single site` workflow does this, or publish the API, build the client with an empty API address and copy it into `wwwroot`). Its temporary address works at once and is a good scratch address.
2. **Point each domain at that site:** bind it to the site in the panel (a site may carry many names) and set its DNS. A certificate is needed on the site for each name unless a CDN or proxy in front terminates https for it (see the CDN section: the origin leg then needs its own certificate or the proxy mode must fit it).
3. **An unregistered domain** shows the Setup page. A platform administrator of a site you already run signs in there and either attaches the domain to a site as an alias or starts a new site on it (a new site comes with its own Admin account and the first sign-in forces a new password).
4. **Every domain starts with its own configuration.** To give a domain its own tenant by hand instead (Admin > Tenants > New tenant), also create the people who run it: a tenant made that way starts with no accounts (use "Work in" to act in it, then Users > New), or the first visit shows nothing to sign in with. If you are locked out, `/recover` (a code and a file in `App_Data`) sets a new password for an account that exists.
5. **To show another domain's configuration** (for example a temporary address showing a domain): open the site on the OTHER domain's address as a platform administrator, Admin > Tenants, and on the domain that should mirror choose the other under "Use the configuration of". It shows that site's content, takes that site's sign-ins, and edits change that site. Choose "Its own configuration" (or Stop mirroring on the Dashboard) to go back; nothing of its own was deleted. One level only.
6. **Do not remove the address you are on** from its tenant (Admin > Tenants refuses it) and do not set a mirror from the address it would change (refused): both would lock you out.

**Proved by running the single-site build as a real process (2026-11-25):** an address no tenant reaches got the client page, its deep links, the page's own security policy, a plain 404 for a missing file and the Setup page's status; the recovery code, its file and the new password went through the real host wiring (a missing file, a weak password and an unknown account were each refused as designed). The same build was uploaded to a second host's API site, which then served the client and the API together on its temporary address.

**Then moved a real domain onto that one site (2026-11-25) and it worked:** the domain was detached from the web site and attached to the single site in the panel (a few seconds). The temporary address and the domain then answered with DIFFERENT configurations from the same folders (different site titles and settings), which the split layout could not do. Two things to know: (a) behind Cloudflare in plain-http mode the first answer from the API was an endless redirect to the same https address, until the API site got `Proxy__Trusted` set to the proxy's published ranges (the CDN section above), after which it answered at once; (b) the domain's tenant, made by hand on the Tenants page, has no accounts: create its Admin from another address (Work in, then Users > New) before relying on that domain.

**Note (2026-11-25):** the second installation was afterwards put back to the split layout (web, API and MCP sites on their temporary addresses with the real domain on the web site), by the owner's choice, so that the free certificates of the temporary addresses carry the API and MCP legs. In that layout the installation is ONE tenant: the real domain and the three temporary addresses are host names of it. Single-site tests continue on separate sites.

## Several web sites on one shared API address: each its own tenant (`Tenancy__OriginHint`)

In the split layout the API chooses the tenant from the address it was called on, so web sites that call the same API address all show one tenant. Set `Tenancy__OriginHint` to `Registered` on the API site and a browser site that is a registered host name of a tenant (its domain, an alias or the `www.` form) gets that tenant through the shared address: the page on the real domain and the page on the temporary address become two configurations with no second API name and no extra certificate. The rule, its limits and the threats are in `docs/Claude-decision-2026-11-origin-hint.md`. It never applies to an unknown address, setup or recovery, a signed-in token still has to belong to the tenant chosen, and with the setting off (the default) nothing changes. Scripts, the desktop app and the MCP site send no Origin and keep choosing by the address they call.

**Before uploading over a site that is already running,** download its `web.config`, `appsettings.json` and `*.runtimeconfig.json` and compare them with your build: a setting changed on the server (for example `System.GC.Server` switched off to save memory) is lost if you overwrite the file; leave that file out of the upload.

**The web site's `web.config` ships with the client** (`client/ai-blog-research-ui/public/web.config`, since 2026-11-27), so there is nothing to make by hand. It rewrites unknown paths to `index.html` (deep links), makes browsers revalidate every file (a static SmarterASP site otherwise cached `index.html` for a year, or sent no cache header at all, and browsers kept an old build), adds basic security headers and sends plain http to https. **Have the certificate before you attach a domain:** the redirect applies to every address except `localhost` and the temporary `*.atempurl.com`, `*.dtempurl.com` and `*.ftempurl.com` addresses. It leaves the `.well-known` folder alone, so keep that folder when you empty a web site. To see a fresh page in a browser that cached an old one, open the address with a query string, for example `/?refresh=1`.

## Three sites on temporary addresses: no certificate to buy (split layout, proved on a second host except the MCP-to-API leg)

Every SmarterASP site, before any domain is attached, answers on its own temporary address (`<account>-siteN.dtempurl.com`, `.atempurl.com` or `.ftempurl.com`), and the panel shows a free certificate on it (the SSL badge next to the address). So the full layout of a web site, an API site and an MCP site can run over https with nothing to buy and no domain. The project reads three addresses; here is where each one is set.

1. **Create the three sites** (web, API, MCP) and confirm each temporary address shows the SSL badge in the panel. Use those addresses in the steps below.
2. **The client's API address** is baked into the client at deploy time. Set the GitHub repository variable `API_URL` to the API site's temporary address, `https://<account>-siteN.<suffix>` (https only, a host name only: no path, port or credentials; the deploy refuses anything else). Leave `SITE_DOMAIN` unset. `.github/scripts/set-api-url.sh` applies it and is tested with good and hostile values.
3. **The API site** gets the usual secrets plus `McpServer__BaseUrl` set to the MCP site's temporary address with a trailing slash. Leave `Site__Domain` unset (when it is set, it overrides both addresses with `api.` and `mcp.` names).
4. **The MCP site** gets `Api__BaseUrl` set to the API site's temporary address with a trailing slash, with `Site__Domain` unset for the same reason.
5. **Tell the API about the temporary addresses.** The API serves only hosts that reach a tenant, and the browser may call it only from registered sites. Use the first-run step in the next section (`Tenancy__AutoAliasToTenantDomain`) for the API address, then register the web site's and the MCP site's temporary addresses on the tenant (Admin > Tenants). A registered temporary address is also allowed to call the API over plain http, which only matters before its certificate works.
6. **Later, with your own domain:** bind `api.<domain>` and `mcp.<domain>` to the SAME sites (a site may carry several names), get certificates for them, set `SITE_DOMAIN`, remove `API_URL`, remove `McpServer__BaseUrl` and `Api__BaseUrl`, set `Site__Domain`, and redeploy the client once. Nothing on the server moves; what changes is the address baked into the client build and any address you saved in an MCP connector.

**Proved on a real second host (2026-11-23, three sites on `*.ftempurl.com`, nothing bought):** the web site on its temporary address signed a person in and worked through the API on its own temporary address, and the changes were written to the database. The order that worked: (1) pool secrets on the API site (database, signing key, `McpServer__BaseUrl`, `Tenancy__AutoAliasToTenantDomain` = the web site's temporary host name, which was already the tenant's domain from an earlier first run) and on the MCP site (the same signing key, `Api__BaseUrl`); no `Site__Domain` anywhere, and none on the web site, which runs no server code; (2) upload the API, MCP and the client built with `API_URL`; (3) one request to the API's temporary address, after which the log says the host "was added as an alias" of the tenant; (4) remove `Tenancy__AutoAliasToTenantDomain` and restart. The API then allowed the web site's origin (its host is the tenant's domain), refused an unregistered origin, and answered the first sign-in with the password-change hold as designed. Both legs between the API and MCP sites are proved: the API calls the MCP site's `/api/hello` with its own token (13 of 13 answered 200, so the signing keys match), and the MCP site built its tool list from the API's `GET /api/tools` through `Api__BaseUrl` (200 in the API log; the same 18 tools as on the first installation, listed with `Claude-author.ps1 -Action tools -ApiBase <api address> -McpBase <mcp address>`). **Not yet proved:** a connector (Claude or another client) saving the MCP temporary address and calling it.

**Adding your own domain to the web site only (also proved, 2026-11-23):** you do not need `api.` and `mcp.` names or their certificates first. Bind the domain (and `www`) to the web site, which the host serves over https with its own free certificate. The pages then load, but the API refuses calls from an origin no tenant owns, so the page shows "The API isn't answering" and no posts. Sign in on the temporary address as a platform administrator, open Admin > Tenants, add the domain as a host name of the tenant and save; it works at once (the `www` name comes with it). The pages keep calling the API at its temporary address, which is fine until you want `api.` under your own domain.

**Traps this proof found.** (a) **Check the signing key box is not blank after pasting:** an empty `Jwt__SigningKey` makes the API answer 503 "configuration incomplete" while the variable's name still shows in the panel; the startup log (`logs/startup-*.log`) names the key. The API and MCP sites need the same signing key value. (b) **The client needs a rewrite file for deep links:** without a `web.config` that rewrites unknown paths to `index.html`, a refresh on `/admin/posts` fails. The proof used a hand-made IIS URL Rewrite rule beside `index.html`; since 2026-11-27 the client ships it. If you copy a build into the API's web root by hand (single-site), delete `wwwroot/web.config`, as `deploy-single.yml` does. (c) **Build with the right shell:** on Windows, `bash` in PowerShell can be the empty Windows Subsystem for Linux stub; run `.github/scripts/set-api-url.sh` with Git Bash and check the built bundle names the temporary API address before uploading.

## Making the site's temporary address work on the first run with the split layout (T4b, operator override)

Every SmarterASP site answers on a temporary address (`<account>-siteN.atempurl.com`) before a domain is attached, but the API only serves hosts that reach a tenant. Before anyone can sign in there is nobody to add the address as an alias, so the install has one explicit step: on the API site (and the MCP site if you use it) add the secret `Tenancy__AutoAliasToTenantDomain` with the domain of the tenant that should answer, for example the domain the seed created for your first site, restart the site, and open the temporary address once. The address becomes an alias of that tenant and works from then on (the API also allows the site on that address to call it). Then clear the setting again. It only ever aliases a real host name that no tenant reaches, never an IP address or localhost, and at most 10 per tenant. New tenants on other domains are created afterwards on Admin > Tenants > New tenant.

## Traps found by the first real install (2026-11-22, one site on a temporary address)

1. **A publish folder is not enough:** the pool needs its two required variables set before the first request, or the app stops with HTTP 500.30 and the reason is only in `logs/` on the site (`stdout_*.log`, `startup-*.log`, then `webapi-*.log` once it runs). Read those first.
2. **Database port:** SmarterASP's hosted PostgreSQL answers on **6432** only; 5432 times out even though the panel's template shows it. A `SASL authentication failed` at start means the user name or password in `ConnectionStrings__Postgres` was refused: test the same login in the panel's pgAdmin first, and use a simple password (letters and digits) while installing.
3. **Edit the right pool:** a pool is named in the panel by an alias you can change, and each site lists in exactly one pool. Set the variables on the pool whose Websites list shows your site, then restart it (a failed in-process start stays failed until the pool is restarted).
4. **Replacing files on a running site:** the app holds its DLLs open. Upload `app_offline.htm` first, replace the files, then delete `app_offline.htm` (the deploy workflows do exactly this).
5. **The first request makes the first site** (it needs the database and the identity tables, which the app creates). If `/api/public/site` still answers "No site is set up", read `logs/webapi-json-*.log` for the line "creating the first site ... failed".

## DNS and certificates for your own domain (found 2026-11-22)

- **Check where the domain is really delegated** before anything else: ask a public resolver for its NS records. A domain registered or moved through the host can already be delegated to a CDN (Cloudflare) even while the host's CDN switch says OFF, and the host's own DNS screen then edits a zone nobody asks.
- **The free certificate needs the name to resolve directly to your server** (a plain A record, no proxy) and the site root to answer HTTP 200. A proxied record, or a second stray A record pointing at another address, fails the preflight.
- **A CDN in its default mode is not a substitute for a certificate on the server:** it encrypts to the visitor, then speaks plain HTTP to your server (the app's https redirect then loops on every page except the root, and sign-in passwords cross the internet unencrypted on that leg). Use a mode that encrypts to the server, which needs a certificate there.
- **The plan's free-certificate allowance can be used up.** The hosting service then answers only "did not queue the SSL request"; look at the SSL page in the panel, and have a certificate in mind (a purchased one, or a free origin certificate if the host lets you import one) before you move DNS.

## Putting a CDN or reverse proxy in front (setting `Proxy__Trusted`)

Behind a proxy the app sees the proxy's address for every visitor. Without telling it which proxy to believe, every visitor shares one rate-limit window (sign-in, comments, search) and the logs name only the proxy; with the proxy in plain-http mode the https redirect also loops. Tell the app which addresses are your proxy and it will take the visitor's address and scheme from the proxy's own headers, and from nobody else.

1. Set the API site's setting `Proxy__Trusted` to the proxy's address ranges, comma separated, for example `198.51.100.0/24,203.0.113.0/24,2001:db8::/32`. Copy the ranges from your CDN's published list and keep them current; a range you leave out is simply not trusted (its visitors then share the proxy's limit again), a range you add wrongly lets that network choose its own address, so add only the proxy's.
2. Leave it empty (the default) when nothing is in front of the app: then no forwarded header is believed from anyone.
3. `Proxy__ForwardLimit` (default 1) is how many proxies in a row are believed, counted from the app. Keep 1 for one CDN; raise it only if two proxies chain in front of the app, and then list both.
4. Use a mode that encrypts to the server (an origin certificate on the server; Cloudflare "Full (strict)"), as described above.
5. Check: sign in wrongly six times from your own address and then from a phone on mobile data. Only your address is limited, not the phone's.
6. The forwarded host is never used: the site is chosen by the host name the server received, so the proxy must pass the original host name through to the app (a CDN does by default). An invalid entry in `Proxy__Trusted` stops the app at start-up with a message naming the setting.

## Locked out and no e-mail set up? (recovery with a file on the host)

You do not need mail to get back in. You prove that you control the installation by putting a file on the host, then choose a new password. Nothing is ever reset to a default password.

1. Open the sign-in page (or the setup page of an address that reaches no site) and use **Locked out and no e-mail? Recover with a file on the host**, then **Get a code**.
2. The page shows a file name such as `recovery-<32 characters>`. Create an empty file with that name in the `App_Data` folder next to the app on the host (over FTP or the hosting panel's file manager; create the folder if it is not there; a `.txt` ending is fine).
3. On the same page give the site address (leave it empty if you opened the site's own address), the user name and the new password, twice. The code is good for 15 minutes and works once; if the site restarts before you finish, ask for a new code.
4. Sign in with the new password. The file is removed by the app when it can; delete it yourself if it stays.

Things that cause trouble: the file is in the wrong folder (it must be the `App_Data` folder of the site that serves the API, not of the web site in the split layout); the name has an extra extension; the code expired. The host tool `Claude-nquad-tool reset-password` is the last resort when you also have database access.

## Listing text for a one-click install (draft for SmarterASP)

**Name:** Adventures blog (AI starter kit). **What it is:** a blog and content site for people who want AI as a collaborator: posts and pages, comments with approval, search, an RSS feed, a Word-like editor, widgets and plug-ins, one admin for several sites on several domains, and an optional MCP server so an AI assistant can draft posts for you to review (it can never publish). **Install:** one site, one database. Open the site address; the first visit creates the site and you sign in with `Admin` and `Admin`, then choose a new password. **Needs:** ASP.NET Core 10 hosting, PostgreSQL. **Cost to run:** the hosting plan plus an AI subscription only if you use the AI features. **Licence:** BUSL-1.1 with a free grant for small operators (see LICENSE). Nothing is sent anywhere unless you configure an AI key or mail server yourself. This text is a draft and is not sent anywhere: the human decides what to send SmarterASP (ticket #3716417).
