# 0010. A stable `id` field for Triple, separate from the (subject, predicate) key

Status: Accepted
Date: 2026-08-14

## Context

Setting up pgAdmin for local Postgres surfaced two things worth
addressing together. First, a real risk: `triple_store` has no
row-level identity a CRUD/admin tool naturally addresses by, and
ADR-0008's uniqueness check runs at the application layer only — a
direct edit through pgAdmin's data grid (the exact SSMS-style
workflow it's being used for) could silently create a second row for
one `(subject, predicate)` slot, which `PostgresTripleRepository.read()`
would then return unpredictably. Second, comparing pgAdmin's "Docker"
and "Railway" servers side by side surfaced that Railway's actual
`triple_store` table holds an unrelated shape (`entity_name`/
`entity_type`/`parent_id`, demo data predating this project's real
TripleRepository work) — currently harmless only because
`TRIPLE_REPOSITORY_NAME` is unset in production (defaults to
`oxigraph`), but a real landmine if that ever changed.

Separately, the user wants an `id` field for CRUD — the natural
surrogate-key instinct from `.NET`/SSMS-style tooling — and wants a
standard nailed down once, then applied to every applicable
`TripleRepository` backend (`PostgresTripleRepository`,
`OxigraphTripleRepository`) and seeded consistently.

## Decision

- **`id` is a UUID, not a database-generated `SERIAL`/auto-increment.**
  The same seed data (`shared/seed_data/initial_triples.json`) has to
  produce the same logical fact whether it's loaded into local
  Postgres, Railway's Postgres, or an Oxigraph store — an
  auto-increment integer is backend-generated and insertion-order
  dependent, actively defeating any future cross-store/cross-
  environment comparison.
- **Assigned at the seed-data/authoring layer, not left to the
  database or the repository by default.** Each entry in
  `initial_triples.json` carries its own pre-generated `id`.
  `TripleRepository.create()` accepts an optional `id: str | None`
  parameter; when omitted, a fresh `uuid.uuid4()` is minted (both
  `PostgresTripleRepository` and `OxigraphTripleRepository`). The
  Postgres `triple_store` table also has `DEFAULT gen_random_uuid()`
  as a safety net for any insert that bypasses the app entirely, but
  the app itself never relies on that default — it always supplies an
  explicit or freshly-generated id.
- **Additive to the interface, not a redesign.** `(subject,
  predicate)` remains the key `create`/`read`/`update`/`delete`/`list`
  are addressed by, unchanged from ADR-0008. `id` is a new field on
  `Triple`, useful for direct row-level reference (pgAdmin, admin
  tooling) and for recognizing "the same fact" across independently
  seeded stores — not a new addressing scheme for the CRUDL methods
  themselves. Making `id` primary would be a materially bigger change
  than what was actually asked for, and ADR-0008's natural key already
  serves the app's own call sites fine.
- **`Triple.id` is excluded from equality/hash**
  (`field(compare=False)`), and trails the dataclass's other fields
  with a default of `""`. Two Triples with identical subject/
  predicate/object_value are the same fact regardless of what id each
  carries — the normal case when the same seed entry lands in two
  independently-generated stores. This is also what keeps
  `shared/seed_data/loader.py`'s `seed_initial_vocabulary()` conflict
  check correct: re-running it against already-seeded data would
  otherwise mistake "same content, different generated id" for a real
  conflict. Trailing-with-default means every existing
  `Triple(subject, predicate, object_value)` call site — the bulk of
  both test suites — keeps working unchanged.
- **Postgres: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, plus a
  real `UNIQUE (subject, predicate)` constraint** — promoted from
  ADR-0008's application-layer-only check now that the schema is being
  deliberately redesigned. The database itself now rejects a
  duplicate slot, not just `PostgresTripleRepository.create()` — the
  actual gap the pgAdmin risk conversation identified. Verified
  directly: `tests/test_triple_repository.py::
  test_live_unique_constraint_is_enforced_by_the_database` inserts a
  duplicate via raw SQL, bypassing the repository the way an
  out-of-band tool would, and confirms Postgres itself raises
  `UniqueViolation`.
- **Oxigraph: `id` lives in each quad's own `graph_name` component**,
  not a synthetic fourth triple. pyoxigraph's `Store` is a genuine
  quad store (`Quad = subject, predicate, object, graph_name`); every
  quad this repository already wrote used the implicit default graph.
  A single subject routinely has multiple predicates (the seed data
  itself does — `application-owner` has both `type` and `name`), so
  an id attached only to the *subject* node couldn't tell those slots
  apart; attached to the graph_name of the specific `(subject,
  predicate)` quad, there's no ambiguity. `update()` reads the
  existing quad's `graph_name` before removing it and reuses that
  same id on the replacement quad, so identity survives a value
  change the same way it does in Postgres.
- **`local/postgres/init/001-schema.sql`'s stale top-of-file comment
  is corrected** — it previously claimed to be "a local mirror of
  ai-research-blog's Railway Postgres schema," which is now confirmed
  false (see Context). It's the source of truth for what the shape
  *should* be, not a mirror of whatever Railway actually holds today.

## Consequences

- Local Postgres and Oxigraph stores were rebuilt/reseeded against
  this standard (2026-08-14): local Postgres's data volume was wiped
  and recreated from the corrected init script, local Oxigraph's
  on-disk store (pre-dating this ADR, holding graph_name-less quads
  `list()` can no longer decode) was wiped and reseeded fresh, and
  `initial_triples.json`'s six entries now carry their own ids.
- **Production Postgres is deliberately untouched by this ADR.** Its
  `triple_store` table still holds the unrelated entity/type/parent
  data described in Context. Migrating or replacing it is a separate,
  explicitly-confirmed action — real production data, even if
  currently orphaned/unused, isn't something this decision unilaterally
  discards.
- Production Oxigraph's persistence gap (`OXIGRAPH_STORE_PATH` unset
  despite a real volume being mounted, found the same session) is
  unrelated to this ADR and still open.
- The one real cost, named rather than ignored: UUIDs are less
  eyeball-friendly than `1, 2, 3` when browsing rows directly in
  pgAdmin. Accepted deliberately - cross-store/cross-environment
  portability is a hard requirement here, the exact case a `SERIAL`
  breaks.
- pgAdmin's own saved-server list (Docker, Railway, Railway readonly)
  lives in an anonymous, unnamed-in-compose Docker volume - rebuilding
  the Postgres container via `docker compose down` for this schema
  change reset it, same risk flagged when pgAdmin was first reviewed.
  Re-registered after the rebuild; not a reason to avoid `down` when a
  fresh volume is genuinely needed, just a known side effect.
