# 0008. TripleRepository: first Repository implementation, CRUDL over triple_store

Status: Accepted
Date: 2026-08-04

## Context

ADR-0004 called for a `FormDataRepository`-style abstract base class
over the triple store, with exact signatures left TBD. ADR-0007
accepted the Repository pattern generally: `IDbProvider` plays the DAL
role (generic, low-level storage access), and domain-specific
Repository classes sit on top of it.

Building the form-shaped repository itself is still blocked on open
questions ADR-0004 left unresolved (schema for `form_definitions`, the
DataFrame-vs-dict DTO routing logic, a first concrete form to prove it
out). What's *not* blocked: a generic repository over the triple store
itself — Create/Read/Update/Delete/List on `(subject, predicate,
object_value)` rows — which is the foundation any form-shaped
repository would need underneath it anyway.

This ADR covers that narrower piece: `TripleRepository`.

## Decision

- **Scope: single-valued triples only.** `(subject, predicate)` is
  treated as a unique slot with one `object_value` — the shape this
  project actually needs today (a form field, a config value). True
  RDF multi-valued facts (the same subject+predicate holding several
  objects at once, e.g. ASR-004's `(user_A, "subscribes_to", user_B)`
  pattern) are a different access pattern with different CRUDL
  semantics and are explicitly out of scope here. If/when that's
  needed, it gets its own repository rather than being forced through
  this one.
- **Table: the existing `triple_store` fixture table**
  (`subject, predicate, object_value`, all text), not a new
  purpose-built schema. ADR-0004 flagged this table as "a test
  fixture, not [the real] schema" — but the real, forms-specific
  schema (ASR-001's open questions: how "schema" itself gets
  represented as data) is still undecided, and inventing a new table
  to answer a question that hasn't been answered yet would be
  guessing. `triple_store` is already live, already has a working
  skip-safe integration test pattern, and is schema-agnostic by
  construction — reusing it now means no migration is needed later
  when the forms-specific design lands on top.
- **CRUDL semantics:**
  - `create` — inserts, raises `ProviderError` if `(subject,
    predicate)` already exists. Real create, not upsert.
  - `read` — returns the `Triple` for `(subject, predicate)`, or
    `None`.
  - `update` — changes `object_value` for an existing `(subject,
    predicate)`; raises `ProviderError` if it doesn't exist yet
    (assumes an existing record, unlike upsert).
  - `delete` — idempotent; no error if the triple doesn't exist,
    matching standard DELETE-is-idempotent convention.
  - `list` — all triples, optionally filtered to one subject (the
    "give me every field for this record" access pattern).
  - Uniqueness on `create` is enforced at the application layer
    (check-then-insert within one connection), not a DB constraint —
    consistent with ASR-001's "no hard constraints enforced at this
    stage" and the "under 100 records" scale target. A small
    check-then-insert race is an accepted tradeoff at this scale, not
    a gap to close now.
- **`PostgresTripleRepository` talks to Postgres directly** — same
  connection-resolution pattern as `PostgresProvider`
  (`DATABASE_URL`, `psycopg2`, raw SQL, no ORM per ADR-0004) — rather
  than being built on top of the existing `IDbProvider` interface.
  `IDbProvider` today is a single-method, hello-world-demo interface
  (`get_message()`); routing triple CRUDL through it would mean either
  growing it into a generic SQL-execution interface with no real
  swappable second backend to justify the indirection, or bolting
  triple-shaped methods onto an interface whose whole point was
  minimalism. Neither adds real value over the repository owning its
  own connection directly, and either would be exactly the kind of
  .NET-DAL-for-its-own-sake layering this project is trying to avoid
  (see AGENTS.md's "Working style" section). `IDbProvider` is
  unchanged by this decision.
- **Testability without a live database:** `connect` is an injectable
  constructor parameter (defaults to `psycopg2.connect`), same
  pattern as `ClaudeProvider`'s `client` parameter. This lets
  `tests/test_triple_repository.py` exercise the real create/read/
  update/delete/list logic — including the uniqueness check and the
  update-must-exist check — with a fake cursor/connection, entirely
  offline. `DATABASE_URL` here resolves to
  `postgres.railway.internal`, Railway's private network hostname,
  which is unreachable from a local dev machine by design; the
  fake-connection tests are what make TDD possible against this code
  at all locally. A second, skip-safe set of integration tests
  exercises the real `triple_store` table when a reachable
  `DATABASE_URL` is present (e.g. in Railway's own environment),
  mirroring `test_container.py`'s existing Postgres integration test.
  Each integration test uses a `uuid4`-suffixed subject and deletes it
  in teardown, so it never touches the `unit-test-1`/`unit-test-2`
  fixture rows or leaves residue in a live/shared database.

## Consequences

- `FormDataRepository` (ADR-0004, still not built) can compose
  `TripleRepository` once its own open questions are resolved, instead
  of duplicating connection/SQL/error-wrapping logic.
- `IDbProvider` remains exactly what ADR-0003 scoped it as; this ADR
  is the record of *why* the triple repository doesn't route through
  it, so that isn't re-litigated as an oversight later.
- Multi-valued triples (ASR-004) are explicitly not served by this
  repository — a future ADR should cover that access pattern
  separately rather than retrofitting it here.
