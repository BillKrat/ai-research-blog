# Decision: seamless install and multi-site onboarding (2026-11-22)

Decided with the human on 2026-11-22. This supersedes the "explicit setting" form of the first-run alias built in T4b (`Tenancy:AutoAliasToTenantDomain`), which stays only as an operator override.

## The expected behaviour (the human's words, condensed)
SmarterASP either lists the app as an installable application or the user deploys from our repo. Either way the install must be as seamless as BlogEngine.NET was: the user opens the site and signs in with `Admin/Admin`, and is made to change the password. If the user later buys a domain, `foo.com` and `foobar.com` are two separate sites, each its own tenant, each starting fresh with its own `Admin/Admin`. If the user started on the temporary address and later attaches a real domain to the same site, that domain is an alias of that tenant.

## Decision
1. **The first host on an empty store becomes the first tenant, automatically.** No setting, no prompt. It gets a fresh `Admin/Admin` (flagged must-change-password, the existing first-sign-in rule) and that person is also the platform administrator. The install seed ships no tenants and no data of ours.
2. **A later unknown host is never created silently.** Anyone who can bind a host name would otherwise get a live site with a default login. An unknown host shows a minimal setup page: no content, no tenant names. A platform administrator can sign in there (a platform administrator is a global person; the sign-in works on a host that reaches no tenant) and chooses, once:
   - **Attach to an existing site:** the host becomes an alias of that tenant (the alias rules from T4b apply).
   - **Start a new site:** a tenant is created on that domain with its own fresh `Admin/Admin` (must-change).
3. **User names are unique within a tenant, not system-wide.** Every tenant can have its own `Admin`. Sign-in looks the name up among the people of the tenant of the host the request came on. A host with no tenant admits platform administrators only, and its token can use the setup endpoints only.
4. **The explicit `Tenancy:AutoAliasToTenantDomain` stays as an operator override** (for scripted installs), default off, and is documented as such.

## Deployment mode: one site by default (decided with the human, 2026-11-22)
SmarterASP gives every site its own temporary address, so a client site and an API site would each have a different one, and a browser on one cannot call the other without registering both and building the client for the other's address. Decision: **the install default is a single site: the API app serves the Angular client itself** (the client build is copied into the API's `wwwroot`, `apiUrl` is empty so the client calls its own host). One temporary address is then the whole app: no cross-origin call, no `api.` host, no pairing, no https mixing. The first host becomes the first site, `Admin/Admin` works, and a domain attached later is an alias of the same tenant.
- **A temporary address is a valid way to evaluate**, not a second-class mode: nobody is locked out of evaluation by not owning a domain yet. Ideally they bring a domain, but nothing requires it.
- **Split mode stays** for production layouts like ours (`www.` static site, `api.` API site). It gains an `API_URL` override in the deploy workflow so it can also be staged on temporary addresses; staging a split pair on temporary addresses additionally needs both addresses registered on the tenant (and https on both), which is why it is not the default.
- **No change to the identity or tenancy logic:** only how the files are delivered. `Origin` is still never trusted to name a tenant.

## Threats and how each is handled
- **Default login window:** between creating a site and its first sign-in anyone can use `Admin/Admin`. Same as BlogEngine; limited by the forced change at first sign-in, the sign-in rate limit, and by never creating a site for a host the person did not choose (point 2). The setup page and the creation step say so plainly.
- **Cross-tenant sign-in:** a person from tenant A must not sign in on tenant B's host with A's name. The lookup is scoped to the request tenant and the token carries the tenant (T1 already refuses a token on another tenant's host); tests pin both.
- **User-name enumeration across tenants:** the same refusal message and timing for "no such person here" and "wrong password".
- **Setup page leaks:** it shows the host name and a sign-in only; the tenant list appears only after a platform administrator signs in.
- **Merging two customers' sites by mistake:** impossible, because attaching is an explicit choice by a platform administrator, never a guess.

## Stages (each its own branch of work with tests first, a stage review and ledger steps)
1. **Per-tenant user names (identity).** `UserName` unique within a tenant; sign-in resolves in the request tenant; a migration for existing people (their names are unique today, so every existing name stays valid); platform administrators resolved globally. Tests: two tenants with an `Admin` each, cross-tenant refusal, the legacy single-tenant case unchanged, enumeration parity.
2. **The empty-store first tenant and an install seed with no tenants of ours.** Split the baseline seed (our development tenants and demo data become a dev-only seed); first host creates tenant, `Admin/Admin` must-change, platform administrator. Tests: an empty store, a second request on the same host, a second host (not created), the dev seed still gives today's local experience.
3. **The setup page for unknown hosts and the attach or new choice.** Anonymous minimal page, platform-administrator sign-in on a tenantless host, setup-only token, "attach" (alias) and "new site" (`TenantCreator` plus its first `Admin/Admin`). Tests: no leak before sign-in, setup-only token cannot reach content or admin APIs, both choices, refusals.
4. **Install guide, regression steps, and the SmarterASP listing text.** Replace the T4b install step with "open the site"; document the override.
5. **Single-site mode (added 2026-11-22; BUILT the same day, see `artifacts/Claude-2026-11-22-single-site-mode.md`):** the API serves the client (static files plus a fallback to `index.html` for client routes, never for `/api`), a deploy-workflow mode that builds the client into the API's `wwwroot` with an empty `apiUrl`, and the install guide's one-site path. Built before stage 3 because the setup page is part of the client and must be reachable from the same host.

## What stays from T4b
Creating a tenant from one place, the alias rules (one tenant per host, no addresses or localhost, the cap), CORS from registered hosts, and the first-run alias logic (reused for "attach" and as the override).

## Not decided here
Tenant data sharing (reuse another domain's data) stays in the backlog. The domain-ownership proof (DNS TXT) stays out of beta.
