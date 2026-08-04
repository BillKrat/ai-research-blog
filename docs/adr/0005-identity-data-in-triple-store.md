# 0005. Identity, role, group, and feature data lives in the triple store

Status: Accepted
Date: 2026-08-01

## Context

ASR-002 requires security/identity to be the cross-cutting foundation
everything else builds on. The initial recommendation (this same
session, in `docs/ASR.md`) was conventional relational tables for
user/role/subscription data, reasoning that this data was
high-frequency and integrity-sensitive — the opposite of ADR-0004's
stated triple-store tradeoff (expensive pivots at volume).

That recommendation didn't hold up against direct counter-evidence
from a prior production system (BlogEngine.net): conventional
relational tables for user extensibility caused recurring, specific
pain — schema migrations for every admin-added custom field,
cross-reference table proliferation for multi-blog membership,
synchronization/versioning problems, and record duplication that
actively hurt SSO when a user belonged to multiple blogs. That's
exactly the class of problem triples are designed to solve, and it's
the same justification ADR-0004 already gives for form data.

The original performance objection was also wrong on inspection.
ADR-0004's "pivoting triples into rows is expensive" tradeoff applies
to bulk/wide pivots across many subjects at once (the pump-records
case). Auth is a point lookup — one user, a handful of predicates —
which triples handle fine with an index on subject. The objection
conflated query *frequency* (real: auth is checked on every request)
with query *breadth/pivot cost* (not applicable to a point lookup) —
two different performance concerns, and the wrong one was cited.

## Decision

- Identity, role, group, and feature data lives in the **same**
  Postgres-backed triple store as form data (ADR-0004), not a separate
  relational schema.
- Accessed through a new interface, `IUserProvider` (naming
  tentative), following the same pattern as `IProvider` / `IDbProvider`
  / `IToolProvider` (ADR-0003). Business logic and the UI depend only
  on this interface, never on the triple store directly for identity
  data.
- A separate `IAuthorizationProvider` interface (also not yet built)
  is the service-layer component that resolves and enforces
  credentials/roles for a given user and resource — distinct from
  `IUserProvider`, the same way `FormDataRepository` (ADR-0004) sits
  on top of `IDbProvider` rather than being it.

## Consequences

- Reversible by design: if this proves wrong in practice, a
  conventional-relational `IUserProvider` implementation can be built
  and swapped in without touching business logic. This is the actual
  safety net that makes trying triples here low-risk rather than a
  one-way door — it's what the interface-driven architecture
  (ADR-0002/0003) exists to make possible.
- SSO and multi-blog membership are naturally represented without
  duplication or new cross-reference tables per relationship type —
  directly addressing the pain that motivated this decision.
- This decision does not apply to bulk/aggregate queries across many
  users at once (e.g. an admin report over all users) — if that
  becomes a real requirement, it needs separate evaluation against
  ADR-0004's original pivot-cost tradeoff.
- Credential/login mechanics (password hashing, the stable identifier
  a JWT's `sub` claim points at) are a narrower, different problem
  from role/group/feature extensibility. Whether that needs a small
  fixed identity anchor separate from the triples, or is itself fully
  triple-based, is still open — see below.

## Open questions

- Exact shape of the identity anchor — a tiny fixed table (user id,
  email, password hash) with everything else (roles, groups, features,
  blog memberships) as triples referencing that id, or fully
  triple-based including the anchor itself. Leaning toward a fixed
  anchor given how narrow and well-understood credential storage is,
  but this is not decided.
- `IUserProvider`'s exact method signatures — same "expand when there's
  a second real need" discipline `IDbProvider` was built with.
- **Configuration abstraction (raised 2026-08-03, not yet warranted):**
  whether `AppSettings` should grow an `IConfiguration`-style
  abstraction (the .NET pattern for unifying multiple config sources
  behind one interface). Same litmus test as every other interface in
  this codebase — needs ≥2 real sources to abstract over, and today
  there's exactly one (`.env`/environment variables). The real trigger
  is *this* ADR's token-vault work: env vars for local dev plus a real
  secrets vault for production would be two genuine sources. When that
  happens, prefer `pydantic-settings` (or `dynaconf`, if the vault
  source is the dominant driver) over hand-rolling an
  `IConfiguration`-shaped interface — the established Python
  equivalent, not a literal port of the C# shape.
- **Token handling, not yet designed:** after authentication, the
  token itself should not be passed between internal processes — it
  gets stored in a vault, and only the bare user id is passed around.
  `IAuthorizationProvider` is the component that takes that user id,
  retrieves credentials, authenticates against downstream systems,
  determines roles, and returns them. MCP's own authorization spec
  (ASR-003) covers client↔MCP-server auth but says nothing about this
  resolution step — it's this project's own design to make.
- Whether `IAuthorizationProvider` runs in-process or as a genuinely
  separate deployable ("a separate app," per the user's own framing)
  — the same open question ASR-003 has for whether the MCP server is
  its own Railway service. Worth deciding together, since both
  determine how many separate deployables this system ends up with.
- Enforcement principle for whichever shape `IAuthorizationProvider`
  takes: authorization must gate what gets *retrieved* (scoped
  queries), not filter results after the fact based on client-held
  role information. Already how ASR-003's MCP tools are designed to
  work; this is confirmation, not a new constraint.
