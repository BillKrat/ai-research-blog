# Decision: the schema browser applications live in Adventures.Foundation (2026-11-27)

Owner: Claude. Approved by the human on 2026-11-27. Names of real sites other than the public project site are written as `<domain-name>`, and hosting addresses as placeholders.

## The vision (the human's words, condensed)

- The desktop client was meant to enforce separation of concerns by reusing `Adventures.*`. It is a Foundation app more than a blog app, so it moves to Foundation under `apps/`, with a generic version of the browser web API.
- A second client, also a schema browser (data later), enforces the same separation.
- Each browser application has its own installation and is configured with the domains it may access: a real feature for developers, who see the schema (later the data) of their configured domains. The applications share one API address.
- The web client is deployed stand-alone to a single site (`<browser-site>`), self-contained and configured for the domains a user has access to, for example `global-webnet.com` and `<domain-name>`.
- The desktop app is likewise stand-alone and uses a web API, the NQuad browser, deployed to its own site (`<browser-api-site>`).
- The applications should have real value of their own while demonstrating the reuse of `Adventures.Foundation`.

## Decisions

1. **Second client: Blazor WebAssembly**, sharing the desktop's view models and presenter.
2. **Names:** `Adventures.Browser.WebApi` (library), `Adventures.Browser.Client` (view models), `apps/Adventures.Browser.Host`, `apps/Adventures.Browser.Desktop`, `apps/Adventures.Browser.Web`.
3. **Beta is a read-only schema browser.** The generic edit endpoints, the pasted-token page and the desktop People screens are retired; a data browser returns later with the business rules and tenant scope.
4. **Access:** a right, `schema.read`, given to Admin and Developer and checked per tenant. Anonymous schema pages stay with the deferred [schema site](Claude-decision-2026-11-schema-site.md).
5. **Which sites a person connects to is never committed.** The configured domain list lives in a per-user file or in the installation's own settings. A web client's static files are public, so a domain list does not go in them.
6. **Three stand-alone pieces:** the web client on `<browser-site>`; the desktop app installed on a computer; one browser API (the host in `apps/Adventures.Browser.Host`) on `<browser-api-site>`, used by both. This replaces the earlier recommendation to serve the browser only from inside each blog API. The web client calls the API from another origin, so the API allows that origin by name. "Self-contained" is read as: the web client's site needs nothing from a blog installation (to be confirmed if it should instead carry its own copy of the API).

## Where a domain's schema comes from (decided 2026-11-27)

Taken as recommended when the human asked for the work to go on without them; say if the other was meant. **The browser API asks the domain's own site** through its read-only schema routes, and the person signs in with their account on that domain. The alternative (the browser API reading each domain's database, with its own sign-in and grants) was not built. Costs of the choice: each domain runs the browser library; sign-ins pass through the browser API, so it is trusted as much as the domains; a domain's sign-in limit sees one caller.

Within one database, sites share their schemas, and the existing `GET api/tenant/mine` with the checked `X-Acting-Tenant` header already selects among them from one address (a web page cannot set `Origin`, so the origin hint cannot do that for a web client). The built design works the same for one database or several: the browser API maps each domain to that domain's API address. See [setup and tests](Claude-schema-browser-setup.md).

## Layout rules (enforced by `Adventures.Architecture.Tests` since stage 0)

- Libraries live under `src/`, applications under `apps/`, tests under `test/`; no source file sits at the repository root.
- A library references only libraries. Nothing references another repository.
- An application reaches no blog, collaboration or blog-hosting library, directly or indirectly.
- Only applications, and the tests of those applications, may need Windows. An application keeps only its start-up files at its project root.
- Committed JSON under `apps/` names only this machine or reserved example addresses; a violation reports the file and key, never the value.
- The solution lists every project. CI builds the whole solution on Windows and `Adventures.Foundation.Linux.slnf` (the same minus Windows projects) on Linux.

## Stages

Built 2026-11-27 (not merged or deployed): 0 guards and CI ([review](artifacts/Claude-2026-11-27-apps-stage-0.md)); 1 and 2 the moves; 3 `SchemaCatalog`; 4 read-only domain routes and the gateway; 5 configured domains in the client; 6 view models and desktop screens; 7 web app ([review of 1 to 7](artifacts/Claude-2026-11-27-apps-stages-1-7.md)). **Remaining:** 8 deploy to the two browser sites (after checking what each serves now), try the install steps, and the human's regression pass.
