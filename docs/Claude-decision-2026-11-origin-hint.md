# Decision: a registered browser site may choose the tenant on a shared API address (2026-11-25)

Owner: Claude. Decided with the human on 2026-11-25. Opt in with `Tenancy__OriginHint` = `Registered`; the default `Off` keeps the 2026-11-01 rule unchanged.

## The problem

In the split layout several web sites (a real domain, a temporary address) share ONE API address, and the API chose the tenant only from the host name the request reached. So every web site that calls that API address showed the same tenant. The ways round it needed a certificate or a CDN for a second API name per domain, or a build per address.

## What changed in the security model since "never read Origin or Referer" (2026-11-01)

That rule was written when nothing tied a token to a tenant. Now a token carries its tenant and a token used for another tenant than the one chosen is refused (403). So a caller-supplied hint can no longer move an authenticated caller to another tenant's data. What is left is anonymous traffic, which can only see a tenant's public content, and that is public at that tenant's own address anyway.

## The rule

A request whose own host already reaches a tenant may be answered for another tenant when the browser's `Origin` is exactly a host name some tenant answers to (domain, alias, or the `www.` form). The tenant is then resolved the way a host is (including a mirror pointer).

- **Origin first.** A plain read (GET or HEAD) with no Origin, such as an image, may use the host of the `Referer`. Anything that changes something (POST, PUT, DELETE) needs the Origin.
- **Registered names only**, from the same list that decides which sites may call the API. The list is kept as one set, so an attacker's made-up origin costs a lookup and nothing is remembered for it (no cache growth).
- **Never** for an unknown request host (so setup and first-run are untouched), never for `/api/setup` and `/api/recovery`.
- **Tokens still decide who you are:** the token's tenant must be the tenant chosen (the existing check), so the hint cannot cross tenants for a signed-in caller.
- **Responses carry `Vary: Origin, Referer`**, so no shared cache hands one site's answer to another.
- **The page address is protected like the API address:** Admin > Tenants refuses removing the host name the person's page is on (`CurrentTenant.Via`).

## Threats considered

| Threat | Answer |
|---|---|
| A script forges an Origin to read another tenant | It only gets that tenant's public content, which is public anyway; signed-in data stays behind the token's tenant |
| An unregistered or odd origin (null, userinfo, a list, another scheme, a lookalike or sub-domain) | Ignored; the host decides |
| The hint triggers setup or a first site | Not applied to unknown hosts or the setup and recovery paths |
| A token from one tenant used on another | Refused as before (403) |
| Cache poisoning across tenants | `Vary: Origin, Referer` |
| Memory growth from many made-up origins | Registered names are one cached set; nothing is stored per origin |
| Brute force against another tenant's sign-in through the shared address | The same exposure as calling that tenant's own host; the same rate limit and lockout apply |
| A caller with no Origin (scripts, the desktop app, MCP) | Unchanged: the host they call decides |

## What it does not do

It does not make tenant selection depend on a header for anyone who does not opt in, and it does not replace choosing the tenant by host: a desktop app or script still picks its site by the address it calls.

## Also changed with it

Admin > Tenants > New tenant now makes the tenant together with its own `Admin` account (the default password, changed at the first sign-in), as the setup page does, on installs that have a sign-in store. A tenant made by hand used to start with nobody who could administer it, and the platform switch gives no rights inside a tenant.
