# Decision (proposed, 2026-10-26): tenant data scoping

**Status:** design for the human's review. Nothing is built or changed. The goal is the vision of one deployed app serving many domains, where the domain picks the tenant and one tenant can never see or change another's data.

## What is true today (read from the code)
- `ITenantResolver` picks a tenant from a host name (`Domain`, longest match, dot boundary). `GET /api/tenant/current` reads Origin, then Referer, then Host. **Display only.** Origin and Referer are set by the caller, so they must never decide access.
- Sign-in uses one tenant from configuration (`Auth:Tenant`, default `global-webnet.com`). The token carries no tenant claim.
- Content (posts, pages, categories, tags, media, collaboration items, settings) has **no tenant field**. It all lives in one N-Quad graph per kind (for example `.../graph/user/...`, `.../graph/legacy`). Today the app is single-tenant in practice.
- Identity rows (the older JSONB tables) do carry a tenant per person. Role assignments point at a Tenant.

## Threats this stage must close
1. **Cross-tenant read:** a request on tenant A's domain returns tenant B's posts, pages, people or settings.
2. **Cross-tenant write:** an administrator of A edits B's data by calling B's ids.
3. **Host spoofing:** a caller claims a tenant through a header (Origin, Referer, X-Forwarded-Host) to be treated as that tenant.
4. **Token reuse:** a token signed in on A is replayed against B's domain.
5. **Silent default:** a host that matches no tenant falls into some tenant's data instead of being refused.

## Options for the isolation
| Option | How | For | Against |
|---|---|---|---|
| A. A store per tenant | A database or schema per domain | Strongest wall | A connection string and migration per tenant; breaks "one code update, many domains"; heavy on a cheap host |
| B. A `Tenant` field on every entity, filtered in each query | Every list and get adds "where tenant = current" | Simple to picture | One forgotten query leaks; the filter lives in many places |
| **C. A graph per tenant (recommended)** | Quads already carry a graph. A tenant's content is written to and read from that tenant's graph only; the repository is created per request for the current tenant's graph | The wall is in one place (the repository), not in every query; fits the store we have; the existing data becomes the first tenant's graph with no rewrite | Needs a per-request repository (the registration already supports a per-request actor the same way); cross-tenant features (a platform administrator) must be explicit |

## Recommendation: C, built in four small stages
1. **T1 Trusted tenant.** Decide the tenant **only** from the server-seen Host (the site bindings on the host decide which names reach the app), never from Origin, Referer or forwarded headers. Add a `tenant` claim to the token at sign-in (the tenant the host resolved to) and refuse a token whose claim differs from the request's tenant. A host that matches no tenant is refused (404), except the development fallback, which works only in the Development environment. Tests first: spoofed headers change nothing; a replayed token is refused; unknown host refused.
2. **T2 Scoped repositories.** Content repositories take the graph from the current tenant per request. The first tenant keeps today's graphs, so the live data is untouched. Tests first: with two tenants seeded, each sees only its own posts and a get by the other's id returns not found; a write goes only to its own graph.
3. **T3 Who administers what.** Rights apply inside the tenant. A platform-wide administrator is a separate, explicit right (`platform.manage`) that no shipped role holds; it lists and creates tenants. Role assignments already point at a Tenant, so a person's rights are resolved for the request's tenant only.
4. **T4 New tenant on a domain.** Create a Tenant with a `Domain`, its graphs, first administrator and default roles from one place, repeatable, so the install guide can describe it. Also the domain verification question below.

## Decisions needed from the human
1. **Isolation level.** Option C (recommended) or A. What changes: A needs a database per tenant (a cost and an operations burden on SmarterASP) but is the strongest wall.
2. **Who creates tenants.** Only the person running the installation (a platform right nobody holds by default, recommended) or any tenant administrator for their own domains.
3. **People across tenants.** Is one person allowed to belong to several tenants with different roles (recommended: yes, with rights resolved per tenant), or is a person tied to one tenant?
4. **Domain proof.** For T4: trust the host's own site bindings (simple, recommended for the beta), or require a DNS TXT record to prove ownership before a domain is added (stronger, more to build).

## What I have not verified
- That SmarterASP's IIS delivers only the bound host names to the application. This is standard IIS site-binding behaviour but must be proved on the real host with a request carrying a different Host header before T1 is called done.
- How many places write to the content graphs besides the repositories (the legacy import, seeds). T2 begins by listing them.
