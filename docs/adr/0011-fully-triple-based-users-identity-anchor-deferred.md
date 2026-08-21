# 0011. Fully triple-based users; identity anchor deferred

Status: Accepted
Date: 2026-08-20

## Context

ADR-0005 put identity/role/group/feature data in the same triple store
as form data, and left one question open: whether a small, fixed
"identity anchor" table (user id, email, password hash) should sit
underneath the triples for credential storage specifically, or whether
users should be fully triple-based including that anchor. ADR-0005
leaned toward a fixed anchor, reasoning that credential storage is
narrow and well-understood, but did not decide.

Two things have since clarified which way this should go:

- The user-CRUDL design session (2026-08-17) needs a concrete answer
  now: `UserRepository`'s `create()` has to mint *something* as the
  subject every one of a user's triples is keyed off, and a fixed
  anchor table vs. a triple-minted UUID are different shapes for that.
- A separate, standalone `poc/` repository is actively building an MCP
  credential-security proof of concept (`mcpauth`) — a self-issued
  JWT-based identity system matching ASR-002's original vision, with
  its own token-vault and per-user-id resolution design. That work is
  still in progress and not yet stable enough to design against.

Splitting credential storage into its own anchor table today would be
designing that boundary twice — once now, provisionally, and again
once `poc/`'s auth design lands — for a piece of functionality
(login/credentials) this project isn't building yet. `ai-research-blog`
has no login view and no credential-checking code today; the only
thing blocking `UserRepository` right now is *how a user's subject URI
gets minted*, which doesn't require an anchor table to answer.

## Decision

- Users are fully triple-based, effective immediately. No fixed
  identity-anchor table is introduced.
- `UserRepository.create()` mints the user's id as a UUID
  (`uuid.uuid4()`) and uses it to construct the user's subject URI via
  `Vocabulary.person(user_id)`. That subject is the key every one of
  the user's triples (profile fields now; roles/groups/features later,
  per ADR-0005) is written against — no separate anchor identifier.
- Credential storage (password hashes, login mechanics) is explicitly
  **out of scope** for this decision and for `UserRepository` as
  currently planned. It is deferred until the `poc/` MCP-credential
  work matures enough to inform how a JWT's `sub` claim, a token
  vault, and this project's user UUID should relate — see ADR-0005's
  "Token handling" open question, which this ADR does not resolve, only
  re-scopes.

## Consequences

- Unblocks `UserRepository`/`UserService` implementation now, without
  a provisional anchor-table design that would likely be thrown away
  once `poc/`'s auth work lands.
- Same reversibility ADR-0005 already established applies here: if a
  fixed anchor later proves necessary, it can be added and the user's
  existing UUID reused as its key — no triple data needs to change
  shape.
- This project has no way to authenticate a user (no login, no
  password check) until the deferred work above is picked back up.
  That's an accepted, explicit gap, not an oversight — `ai-research-blog`
  is deliberately building the create/read/update/delete/list shape
  first, ahead of auth, per the agreed build order in the user-CRUDL
  design session.

## Open questions

- How the `poc/` `mcpauth` design's JWT `sub`/vault pattern maps onto
  this project's user UUID, once that work is stable — this is the
  question ADR-0005 raised and this ADR explicitly punts forward
  rather than resolving.
- Whether `UserRepository`'s minted UUID should be reused directly as
  the eventual JWT subject, or whether a separate mapping layer is
  needed — undecided, blocked on the same dependency above.
