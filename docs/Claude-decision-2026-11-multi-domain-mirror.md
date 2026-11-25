# Decision: many domains on one installation, with a mirror pointer (2026-11-25)

Owner: Claude. Decided with the human on 2026-11-25 after a second installation locked its owner out (the cause was a cleared API alias, see the backlog section "Lockout lessons from the second host"). Names of real sites are kept out of repo docs.

## The vision (the human's words, condensed)

One set of folders on the host serves 2 or more domains, because the address a request arrives on picks the configuration.

- An unregistered domain that arrives reaches the Setup page, and the existing sign-in configures it.
- Every domain starts with its own configuration.
- Every domain can choose another domain's configuration from a drop-down of all configured domains (so a temporary address can show a real domain's site).
- Setting the drop-down back to none resumes the domain's own configuration. Nothing is deleted or altered; it is only ignored while the pointer is set.

## What already exists

- Setup page for an address that reaches no tenant: a platform administrator signs in and attaches the address to a site or starts a new one (onboarding stage 3).
- A graph per tenant, so each domain has its own configuration.
- The Dashboard's tenant panel has "Make <host> mirror": a drop-down of tenants with "Default (stop mirroring)". It stores the host as an **alias on the target tenant**, and a host can reach only one tenant, so a temporary address that is already its own tenant cannot mirror another.

## Decisions

1. **A pointer on the requesting tenant.** A tenant gets a "Use the configuration of" field (empty, or another tenant). While it is set, the host's requests are served from the target tenant's data and settings; the tenant's own record and data are untouched. Setting it back to none resumes them. This replaces the alias-on-target as the way to mirror (aliases stay for extra host names of one tenant).
2. **One level only.** A tenant that mirrors another cannot be chosen as a target, and a target that later starts to mirror is ignored, so there are no chains or cycles.
3. **Platform administrators only** see the list of all domains and set a pointer, because a tenant administrator would learn the other tenants' domain names and could point a host at data that is not theirs (a name decides whose data a request sees).
4. **A mirror shares data.** A temporary address mirroring a domain edits that domain's content. The admin area shows a "Mirroring <domain>" banner while a pointer is set. A read-only mirror may come later for a true scratch pad over real data.

## Layout this needs

One folder with many domains is the single-site layout (the API serves the client). In the split layout (separate web and API sites) the API picks the tenant from the address it is called on, so each web site would need its own API address (a second host name on the same API site, with a certificate). Single-site avoids that. `deploy-single.yml` has never been run; each domain still needs its own certificate.

## Stages

1. **Lockout items** (backlog): Admin > Tenants refuses a change that cuts off the address it is made from; recovery without e-mail by a one-time code and a file in `App_Data` over FTP (never a reset to default credentials, never triggered by failed sign-ins).
2. **The mirror pointer**: the field, the resolver change (tests first, including the one-level rule and that nothing of the own tenant changes), the drop-down for any domain, the banner.
3. **Install guide** for one folder with many domains, then the first real run of the single-site deploy.

## Risks to test

- A pointer never exposes a tenant's data to someone who could not sign in to that tenant (rights and sign-in resolve against the effective tenant; token tenant claim must match it).
- Cache invalidation when a pointer changes (the tenant and CORS caches).
- The setup page and the first-run rules (first host, auto alias) still behave when pointers exist.

## Status (2026-11-25)

Stage 1 (lockout items) is built, merged and deployed. Stage 2 (the pointer) is built on the session branch, not yet deployed: see [the stage review](artifacts/Claude-2026-11-25-mirror-pointer.md). One rule was added while building it: a pointer cannot be set from the very site it would change (the person would be signed out of their own account with no way back); clearing is always allowed. Stage 3 is next.
