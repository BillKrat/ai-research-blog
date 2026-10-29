# Install guide: your own copy on SmarterASP.NET (draft)

**Status: draft written from how our own sites were built. Not yet proved on a fresh installation.** Every step marked *(ours)* is one we did on our own sites; *(unproved)* means we have not repeated it from scratch. The proof run uses a spare domain, written here as `<domain-name>`, and turns this draft into the real guide. For the cheap-hosting background see [Claude-developer-setup-guide.md](Claude-developer-setup-guide.md).

**What you end up with:** three sites on one hosting account, `www.<domain-name>` (the Angular client), `api.<domain-name>` (the API) and `mcp.<domain-name>` (the MCP server), a PostgreSQL database, free HTTPS certificates, and GitHub Actions that test and then deploy on every merge to `main`. Running cost: about $38 a quarter for hosting plus an AI subscription if you use one.

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
| api | `M2MClients__Clients__<n>__Secret` | one random secret per machine client you switch on; bound by position, never insert, only append |
| api | `Anthropic__ApiKey` | optional; only for "Ask Claude" on exceptions |
| mcp | the same signing and client settings it needs to validate the API's tokens | see the MCP site's settings file |

If the API shows a 503 "reporting app", a required secret is missing and the page names it. If sign-in answers 500, the API cannot reach the database.

**On GitHub (repository secrets):** `FOUNDATION_TOKEN` (only if your Adventures.Foundation fork is private: a fine-grained token with read-only Contents access to that one repository); `SMARTERASP_FTP_SERVER`; `SMARTERASP_FTP_USERNAME` and `SMARTERASP_FTP_PASSWORD` (client site); `SMARTERASP_API_FTP_USERNAME` and `SMARTERASP_API_FTP_PASSWORD`; `SMARTERASP_MCP_FTP_USERNAME` and `SMARTERASP_MCP_FTP_PASSWORD`. Use the scoped users from step 3.

## 6. Run the tests first
Push a branch: the `Tests` workflow runs the API, MCP and client suites on GitHub. Expect: three green jobs. A deploy only runs after the same tests pass.

## 7. First deploy
Merge to `main` (or run each deploy workflow by hand): MCP, then API, then client. Each API deploy takes the site offline for a moment (`app_offline.htm`) and the workflow then checks the health endpoint. Expect: all three runs green; `https://www.<domain-name>` shows the public site.

## 8. First sign-in and hardening *(ours, learned the hard way)*
1. The first start seeds the store and creates `Admin` and `Claude` accounts with well-known default passwords, flagged to be changed. **Sign in as `Admin` at once and change the password** (profile page).
2. For `Claude`: if you do not use an AI collaborator, set a strong password through Admin > Users > Set password or delete the person once another administrator exists. We found our own unchanged default account this way.
3. Create a second administrator before you remove or demote anyone; the app refuses to remove the last one.
4. Create the four named test people from [Claude-test-users.md](Claude-test-users.md) on a test copy, never on real customers' data.

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
2. A first-run page that forces the default passwords to change and offers to remove the `Claude` account.
3. One script that checks every secret and DNS name before the first deploy.
