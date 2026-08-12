# SQLite → RDF via morph-kgc: review + feasibility findings

Date: 2026-08-10
Status: research notes for next session — nothing here is an ADR yet.

## The question this answers

> Can `morph-kgc` take `blog-research.db` and turn it into R2RML we
> import into our triple store(s), so we're not reinventing a
> SQL→RDF mapper?

**Yes, with one correction to the framing.** morph-kgc doesn't hand you
a standalone `.r2rml.ttl` file to carry off and feed into some other
engine — morph-kgc itself *is* the R2RML/RML engine. You give it a
mapping (which can be hand-written R2RML, hand-written RML, or
YARRRML — a friendlier YAML syntax that compiles to the same RML
model) plus a `db_url`, and it executes that mapping against the live
database and materializes RDF directly (RDFLib graph, Oxigraph store,
Turtle/N-Triples/N-Quads files, or a Kafka stream). So the actual
pipeline is:

```
blog-research.db  →  RML/R2RML mapping  →  morph-kgc  →  RDF triples
```

not "db → R2RML file → some other tool → triples." That's a better
deal than the original assumption, not a worse one: one dependency,
one execution step, and it's pip-installable
(`pip install morph-kgc[sqlite]`).

**The best news:** morph-kgc ships a *bootstrapping* feature
(`python -m morph_kgc.bootstrapping`) that inspects a database's
actual schema (tables, columns, types, primary keys, foreign keys) via
SQLAlchemy and auto-generates a starting YARRRML mapping — one
`TriplesMap` per table, literal properties for every column with the
SQL type mapped to the correct `xsd:` datatype, and object properties
that follow foreign keys as joins to the referenced table's map. I
ran it end-to-end against the actual `blog-research.db` (not a toy
example) — see "Proof of concept," below. It worked on the first
real attempt (after one missing-dependency fix).

## What's in this folder

- `bootstrap_config.ini` — the config that drove the POC run. Relative
  `db_url` (`sqlite:///../blog-research.db`) and `output_dir: .`, so
  it should run as-is from inside `artifacts/rdf-poc/` once the tool
  is installed.
- `direct_mapping.yarrrml.yml` — the YARRRML mapping morph-kgc
  auto-generated from `blog-research.db`'s actual schema. One mapping
  block per table (`tenants_map`, `organizations_map`, `users_map`,
  `roles_map`, `permissions_map`, `user_organizations_map`,
  `role_permissions_map`, `user_roles_map`).
- `blog_research_graph.ttl` — the 197 triples materialized from that
  mapping against the real seed data. (morph-kgc's bootstrap tool
  wrote this with a `.nt` extension even though the content is Turtle
  — renamed here for accuracy; see "Rough edges," below.)

Reproduce with (from a venv with `pip install -e './morph-kgc[sqlite]' pyyaml`):

```bash
cd ai-research-blog/artifacts/rdf-poc
python -m morph_kgc.bootstrapping bootstrap_config.ini
```

## Proof of concept — what actually happened

1. Installed `morph-kgc` from the local `repos/morph-kgc` checkout
   (editable install) with the `sqlite` extra
   (`SQLAlchemy` + `sql-metadata`) into a scratch venv. Version
   `2.10.0`, Apache-2.0 licensed.
2. First run failed: `ModuleNotFoundError: No module named 'yaml'`.
   The bootstrapping module imports `yaml` (PyYAML) directly, but
   PyYAML isn't in `pyproject.toml`'s dependencies anywhere (the core
   package uses `ruamel.yaml` instead). This looks like a real gap in
   morph-kgc's own packaging for the bootstrapping subcommand
   specifically — worked around by `pip install pyyaml`. Worth a
   one-line note if this ever gets reported upstream.
3. Second run succeeded: connected to `blog-research.db`, found all 8
   tables, generated `direct_mapping.yarrrml.yml`, and materialized
   **197 triples** to Turtle. No manual mapping authored by hand.
4. Spot-checked the output: subjects, datatypes, and FK-driven object
   references all look correct (verified against `organizations`,
   `role_permissions`, `users` — e.g. `Bill Kratochvil`'s row surfaces
   correctly as `ns4:email "billkrat@example.com"` linked into the
   right tenant/org triples).

## How to read the generated mapping — it's a scaffold, not the target model

The bootstrap mapping is morph-kgc's equivalent of the W3C **Direct
Mapping** spec: one resource per row, one predicate per column, FKs
become object properties. That's a real, valid, useful starting point
— but it is *not* the domain-shaped graph you'd actually want to
query. Two things stand out that the next session should decide on
deliberately rather than just accepting the scaffold:

- **Join tables become their own resources.** `user_organizations`,
  `user_roles`, and `role_permissions` each get their own subject IRI
  (e.g. `base:user_organizations/user_id=...;organization_id=...`)
  with `ref-user_id`/`ref-organization_id` edges pointing out to the
  two sides. That's a faithful copy of the relational shape, but the
  graph-native way to say "this user belongs to this org" is a
  *direct* edge (`user --hasOrganization--> organization`), with no
  reified join-table node in between — unless you specifically want
  to attach properties to the *membership itself* later (e.g. "joined
  on X date"), in which case reification is the right call and this
  scaffold is already halfway there.
  `morph-kgc/examples/postgres` and the GTFS example under
  `morph-kgc/examples/rdb/mapping.rdb.yml` both show the "collapse the
  join into a direct predicate" pattern using YARRRML's
  `mapping: <other>` + `condition: {function: equal, ...}` — same join
  mechanism the bootstrap already uses, just pointed at the two
  *entity* tables instead of materializing the join table as a node.
- **No real vocabulary yet.** Every class/predicate IRI bootstrap
  generates is invented fresh under `https://blogresearch.net/id/...`
  (e.g. `base:organizations~iri`, `base:organizations#name`). That's
  fine for a first pass, but reusing established vocabularies where
  they fit — `foaf:name`/`foaf:mbox` for users,
  [ORG ontology](https://www.w3.org/TR/vocab-org/) (`org:Organization`,
  `org:Membership`, `org:memberOf`) for the tenant/org/membership
  shape, `dcterms:created` instead of a bespoke `#created_at` — would
  make the resulting graph interoperable with anything else that
  speaks those vocabularies, at near-zero extra cost since it's just
  swapping predicate IRIs in the mapping.

Recommended next-session shape: keep the bootstrap output as a
reference/diff baseline, then hand-adapt one hand-written RML/YARRRML
mapping (à la `morph-kgc/examples/postgres/mapping.ttl` or
`examples/rdb/mapping.rdb.yml`) that (a) collapses the three join
tables into direct edges and (b) swaps in real vocabulary for at least
`users`/`organizations`/`tenants`. That's a small, well-scoped task —
not a rewrite.

## Rough edges worth knowing about going in

- **`pyyaml` isn't declared as a dependency** of the bootstrapping
  extra (see above) — just `pip install pyyaml` alongside
  `morph-kgc[sqlite]` and move on.
- **Output filename extension is wrong for non-NT/NQ/JELLY formats.**
  `graph_builder.serialize_graph()` only maps `.nt`/`.nq`/`.jelly`
  extensions; anything else (including the `TURTLE` we asked for)
  silently falls back to a `.nt` filename while still writing genuine
  Turtle content. Not a blocker — the content is correct — just rename
  the file, or request `N-TRIPLES`/`N-QUADS` explicitly if the
  filename needs to be trustworthy unattended.
- **SQLite `db_url` needs 4 slashes for an absolute path**
  (`sqlite:////Users/...`) or 3 for a path relative to wherever the
  process runs (`sqlite:///../blog-research.db`) — easy to get wrong
  once, as I did on the first attempt.
- **Bootstrap always queries live data for column types on SQLite**
  (`SELECT typeof(...) FROM table LIMIT 1` in one code path, `PRAGMA
  table_info` in another) rather than trusting the declared schema
  everywhere — shouldn't matter for a schema this simple/consistent,
  but worth knowing if a column's actual stored values ever disagree
  with its declared type.

## Where does this leave "our triple store(s)"?

This is the one place the original framing needs a real correction,
not just a caveat — it affects which target is realistic without
extra tooling:

- **The project's own Postgres `triple_store` table**
  ([ADR-0008](../../docs/adr/0008-triple-repository-first-implementation.md))
  is already shaped as `(subject, predicate, object_value)` rows —
  i.e., it's already an RDF-triple-shaped table, just not a real
  RDF/SPARQL engine. morph-kgc's N-Triples output is a very natural
  fit here: each materialized triple is one row. A small loader
  (parse N-Triples with `rdflib`, `INSERT` each `(s, p, o)` via
  `PostgresTripleRepository`/raw SQL) is a short, self-contained task
  — good candidate for next session once the mapping itself is
  settled.
- **Oxigraph** (`pyoxigraph`, already a morph-kgc dependency) is a
  genuine embedded RDF store with real SPARQL 1.1 — morph-kgc can
  materialize straight into it (`morph_kgc.materialize_oxigraph(...)`)
  with zero extra plumbing. Worth considering as *the* real triple
  store for RDF-shaped data, separate from the Postgres
  `triple_store` table (which — per ADR-0008 — is explicitly scoped
  to single-valued, non-RDF-multi-valued triples; genuine RDF facts
  are out of that repository's stated scope already).
- **Neo4j Aura / Memgraph** (per your existing dual-graph-DB notes)
  are **not** RDF/SPARQL stores — they're Cypher-based property graph
  engines. morph-kgc's README lists Neo4j/Kùzu only as *input* data
  sources (reading an existing property graph and turning it into
  RDF), not as materialization *targets*. Getting morph-kgc's RDF
  output into Neo4j specifically would need a bridge — Neo4j's own
  `n10s` (neosemantics) plugin does RDF import into Neo4j, but that's
  a separate piece of infrastructure, not something morph-kgc does
  for you. Memgraph has no equivalent RDF-import path that I found in
  a quick look — triples would need hand-translation into Cypher
  `CREATE`/`MERGE` statements. **Bottom line: morph-kgc solves
  "SQLite → RDF" cleanly; it does not solve "RDF → Neo4j/Memgraph"
  at all** — that's a separate, currently-unstarted piece of work if
  the dual-graph-DB strategy is meant to hold the same data as the
  triple store.

## SQL artifact review — what I changed and what I left as a flag

Made directly (small, mechanical, reversible — regenerated
`blog-research.db` from the corrected scripts, verified
`PRAGMA foreign_key_check` still clean and all 8 row counts unchanged
afterward; the pre-change `.db` is kept alongside as
`blog-research.db.bak-preRDFreview` in case you want to diff or
discard it):

- **`created_at` defaults now produce real ISO-8601 /
  `xsd:dateTime`-valid strings.** Was
  `DEFAULT CURRENT_TIMESTAMP` → SQLite emits `YYYY-MM-DD HH:MM:SS`
  (space separator, no timezone) — not a valid `xsd:dateTime` lexical
  form. Now
  `DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))` → e.g.
  `2026-08-10T14:04:30Z`. This is exactly the kind of thing that's
  cheap to fix before there's real data riding on the format and
  annoying after — worth doing now specifically because the RDF
  conversion goal makes datatype correctness matter more than it did
  as a plain relational fixture. (The auto-generated mapping still
  typed these columns `xsd:string`, since SQLite's declared column
  type is `TEXT` either way — casting to `xsd:dateTime` in the mapping
  is a separate, deliberate step for the hand-adapted mapping, not
  something the schema fix does automatically.)
- **Fixed a stale comment on `permissions`.** It said
  `-- PERMISSIONS (global or tenant-scoped)` but the table has no
  `tenant_id` column — it's global only. Reworded the comment to match
  reality rather than adding a column nothing currently needs
  (per `AGENTS.md`: don't build for a requirement that isn't real
  yet).
- **Fixed a typo in seed data:** `organizations.name = 'Phython'` →
  `'Python'` (the `adventuresEdge.net` / Python-programming-and-tech
  blog).

Flagged, and **confirmed intentional** by the user (2026-08-10) — no
change needed:

- `adventuresEdge.net` (tenant `d222...`) has an organization named
  **`blogResearch`** — same string as the *other* tenant's domain name
  (`blogResearch.net`, `d111...`), but a genuinely different blog with
  different content, not a naming collision to fix. Confirmed blog
  purposes, for when the Blogs feature (see `AGENTS.md`/ASR docs) needs
  real descriptions:
  - `blogresearch.net/BlogAI` — Claude-generated posts helping
    developers (and the user) understand the `ai-research-blog`
    project itself.
  - `blogresearch.net/Saints` — real-world research application: posts
    on Christian saints.
  - `adventuresedge.net/blogResearch` — adventures learning to program
    in an AI environment.
  - `adventuresedge.net/Python` — adventures learning Python, from a
    C#/.NET background.

## Suggested next session

1. Decide: keep the direct-mapping scaffold as a baseline, then
   hand-write one adapted mapping that collapses the three join
   tables into direct edges and swaps in FOAF/ORG-ontology predicates
   for at least `users`/`organizations`/`tenants`.
2. Decide the real triple-store target: Postgres `triple_store` table
   (via an N-Triples loader) vs. Oxigraph (direct, already wired) vs.
   both for different purposes. This also settles whether the
   Neo4j/Memgraph bridge gap above needs solving now or can stay
   parked.
3. If pursuing the Postgres `triple_store` route, the loader is small
   enough to build directly on `PostgresTripleRepository`
   (ADR-0008) — no new abstraction needed.

## Follow-up requested by the user (2026-08-10): check native import tooling first

Before writing any custom RDF → property-graph loader for
Neo4j Aura / Memgraph (see "Where does this leave 'our triple
store(s)'?" above), check whether either platform's own import
tooling already closes the gap — same "don't reinvent the wheel"
framing as the original morph-kgc question.

**Neo4j Aura**, from the Console's own "New data source" import screen
(`console.neo4j.io/.../studio/import/sources`) — screenshot reviewed
2026-08-10: the primary picker offers relational/warehouse/file
sources only (PostgreSQL, MySQL, SQL Server, Oracle, BigQuery,
Databricks, Redshift, Snowflake, Azure Synapse, AWS S3, Azure Blobs,
Google Cloud Storage, local CSV/TSV) — no RDF/R2RML option there.
Below that, three more tiles worth checking in detail next session,
none inspected closely yet:
- **"Migrate from self-managed"** — imports from another Neo4j
  instance, unlikely to help (source is SQLite/RDF, not Neo4j).
- **"Unstructured data"** — AI/ML-based extraction from
  PDF/TXT/etc., not a structured-mapping path; unlikely to help.
- **"Development tools"** — "connect to various data sources using
  connectors, drivers, and APIs." This is the one to actually check:
  possibly where Neo4j's `n10s`/neosemantics RDF-import plugin (or an
  equivalent Aura-hosted connector) would surface, if Aura exposes it
  at all. Not yet confirmed either way.

**Memgraph** — not yet checked at all this session. Look at its import
docs/UI for anything RDF-aware, and separately for CSV/Cypher
export/import that might let Aura and Memgraph feed each other even
without RDF-specific tooling on either side.

**Worst case**, confirmed acceptable to the user: write a small custom
loader (N-Triples → Cypher `MERGE` statements is the likely shape —
straightforward given morph-kgc already gets us clean triples, see
the POC above).

## CLOSED OUT (2026-08-11): Neo4j Aura ruled out, Oxigraph is the new candidate

The "worst case" custom loader above was actually built and tested: it
worked correctly but was "painfully slow" — not realistic for a
production environment. That result, plus a review of the Neo4j
community forum (`artifacts/neo4j/rdf-import-results.txt` for RDF
import via Neosemantics/n10s, `artifacts/neo4j/batch-results.txt` for
bulk loading generally), confirms this wasn't an implementation
problem to optimize away:

- **n10s** (the only RDF-import path into Neo4j) is a labs-status
  plugin with a long history of partial imports, fragile parsing, and
  install friction — and its own availability on AuraDB specifically
  was never confirmed working in the threads reviewed.
- The only genuinely fast Neo4j load path, `neo4j-admin database
  import`, is an offline CLI tool requiring direct filesystem access to
  the server. **Aura is a fully managed service — no shell, no
  filesystem, no `neo4j-admin`.** Every hand-rolled loader (this
  project's included) is stuck doing transactional Cypher writes
  instead, which the forum confirms is structurally slow at volume
  (deadlocks, memory blowups) regardless of how it's written.

**Conclusion: Neo4j Aura is ruled out as the deployed/production target
for this project's RDF data.** Full reasoning and evidence trail in the
`project-neo4j-aura-graph-db-decision` memory. Local Memgraph's role is
now an open question rather than a settled "dev half" of a pair — it
wasn't implicated by this evidence (self-hosted Docker still has
filesystem/CLI access `neo4j-admin`-equivalent tooling could use), but
it hasn't been checked either.

**New candidate: Oxigraph** (`pyoxigraph`) — an embedded RDF/SPARQL
1.1 store, already a `morph-kgc` dependency
(`morph_kgc.materialize_oxigraph()`), already flagged above as worth
considering as *the* real triple store. It sidesteps both failure modes
above structurally: no RDF-import bridge needed (it's native RDF, not a
property graph), and its bulk loader is a Python API, not a
server-CLI tool that requires access a managed host might not grant.
Preliminary research looks promising but is unverified AI-summary
content, not a primary-source read or a POC against this project's own
data — see `project-oxigraph-candidate-evaluation` memory for the
caveats and the two new questions it raises instead (Railway disk
persistence for the on-disk store, single-writer/single-process
concurrency), and for the suggested next POC step (load
`blog_research_graph.ttl` from this folder into an on-disk
`pyoxigraph.Store` and query it).

**AllegroGraph was also researched as a candidate** (see
`artifacts/Allegro/initial-research.txt`) — a client-server RDF store
with native reasoning (OWL/RDFS++, Prolog) and built-in vector storage,
which would have resolved Oxigraph's single-writer/multi-replica
question by design (many app instances can talk to one server, same
model as this project's existing Postgres service). Deprioritized in
favor of Oxigraph for now: it reintroduces the self-hosting ops burden
that Aura was originally chosen over self-hosted Memgraph to avoid, and
its free tier caps at 5,000,000 triples — real costs to pay before
Oxigraph is actually shown to fail at something. Kept as the escalation
path if OWL/Prolog reasoning becomes a real requirement, the API service
goes multi-replica, or the app outgrows Oxigraph's practical ceiling —
none of which are true today.

## Oxigraph POC (2026-08-11): both open questions resolved with real evidence

`artifacts/rdf-poc/oxigraph_poc.py` — loads `blog_research_graph.ttl`
into a scratch on-disk `pyoxigraph.Store` and exercises exactly the two
things the preliminary research's claims needed verifying against:

1. **`Store.bulk_load()` claim, verified against the installed
   package itself** (`pyoxigraph` 0.5.9), not just the AI-generated
   research file — its own docstring confirms it's a real, documented
   API distinct from `.load()`, "designed to be as fast as possible on
   big files." The research file's claim checks out.
2. **On-disk persistence, verified by actually testing it**: the script
   opens a **second, brand-new** `Store` instance pointed at the same
   directory after the first one wrote and flushed — not just reusing
   the same Python object — and queries it. Result: 197 triples, an
   exact match to the original morph-kgc POC's triple count above, with
   zero data loss across the reopen.
3. **A real SPARQL query against the reopened store** correctly returns
   all 4 known organizations (`BlogAI`, `Python`, `Saints`,
   `blogResearch`) — confirming the round trip is semantically correct,
   not just triple-count-correct.

**Decision: Oxigraph is the adopted near-term target** for this
project's real RDF triple store, given today's tiny data scale
(ASR-001: under 100 records per user context) and single-instance
deployment — neither of Oxigraph's own open questions (scale ceiling,
multi-replica concurrency) are live concerns yet, and it adds zero new
services to operate. **Still open, not yet tested:** this POC ran
against a local scratch directory, not the `ai-research-blog-volume`
Railway volume already provisioned for this purpose — confirming the
same persistence behavior holds across an actual Railway redeploy
(not just a fresh `Store` object in the same process) is the next real
step before treating this as production-ready, not just POC-verified.

## CRUDL POC (2026-08-11): the real design question, surfaced by real behavior

`artifacts/rdf-poc/oxigraph_crudl_poc.py` — before wiring an actual
`OxigraphTripleRepository`, exercised the individual-quad primitives a
repository would actually call (`add`/`remove`/`quads_for_pattern`),
not just `bulk_load()`. All five CRUDL-shaped operations behaved
exactly as expected: read one value, create a new triple, "update" (no
atomic UPDATE primitive in RDF — it's `remove()` then `add()` as two
separate calls, a real transactional-window risk to design around),
delete (confirmed idempotent — removing an absent triple raises
nothing, matching `TripleRepository.delete()`'s contract), and list by
subject.

**The real finding is in section 6.** `shared/repositories/interfaces.py`'s
existing `TripleRepository` is deliberately **single-valued**:
`create()` raises `ProviderError` if a `(subject, predicate)` already
has a value; `update()` requires exactly one existing value to change.
That scoping was a deliberate choice made *for* Postgres's shape
(ADR-0008), not an RDF limitation. Oxigraph has no such constraint —
the POC added two different objects for the same `(subject,
predicate)` and **both persisted, both came back on query**. That's
not a bug to work around; it's the actual capability RDF and Oxigraph
were chosen for in the first place (genuine multi-valued facts, e.g.
ASR-004's `user-subscribes-to-user` triples), and it's exactly what
`TripleRepository`'s single-valued contract forbids.

**This means `OxigraphTripleRepository` is a real design fork, not
just an implementation task, and it needs a decision before writing
code:**

- **(a) Implement `TripleRepository` as-is**, enforcing single-valued
  behavior in the repository layer on top of a naturally multi-valued
  store. Gives a drop-in alternative to `PostgresTripleRepository` —
  same interface, same call sites — but throws away the actual reason
  Oxigraph was chosen over the existing Postgres triple store.
- **(b) A new interface with real multi-valued semantics.** Keeps what
  Oxigraph is actually for, but isn't a drop-in replacement, and needs
  its own CRUDL contract designed from scratch — e.g. what "delete"
  means when there are 3 objects for one `(subject, predicate)`: all
  of them, or one specific one (which needs the object value, or some
  other identifier, in the call signature)?

Not decided yet — see the `project-oxigraph-candidate-evaluation`
memory for the open decision.

## Decision (2026-08-11): (a), single-valued drop-in — and it's built

Chose **(a)** — enforce `TripleRepository`'s existing single-valued
contract in the repository layer, deferring a real multi-valued
interface until ASR-004 gives it a concrete consumer, rather than
designing that interface speculatively now.

`shared/repositories/oxigraph_triple_repository.py` implements
`OxigraphTripleRepository`, a full drop-in alternative to
`PostgresTripleRepository` — same `TripleRepository` interface, same
CRUDL contract, same `ProviderError` wrapping. Two things came up
building it that weren't visible from the POCs alone:

- **RDF requires subject/predicate to be valid IRIs**; `TripleRepository`'s
  contract takes arbitrary opaque strings (the same fixture shape as
  `"unit-test-1"` in the Postgres tests, which isn't a valid IRI on its
  own — `pyoxigraph.NamedNode` rejects it, "No scheme found in an
  absolute IRI"). Resolved with two fixed `urn:` namespaces
  (`urn:triple-repository:subject:` / `...:predicate:`) plus
  percent-encoding, fully reversible, handling arbitrary characters —
  see the module docstring for the reasoning.
- **An on-disk store can only be held open by one live `Store` object
  at a time** — a RocksDB file lock, discovered when a test tried to
  open a second repository instance against the same path while the
  first was still alive (`OSError: lock hold by current process`).
  This is a *stricter* version of the multi-replica concurrency
  question already flagged for Oxigraph: it bites even sequentially,
  within a single process, not only across multiple app instances.
  Fix is straightforward (release all references to the first
  instance before opening a second one against the same path) but
  matters for however this eventually gets wired into
  `blogresearch/config/registrations.py` — one long-lived instance,
  not one per request.

`tests/test_oxigraph_triple_repository.py` — 22 tests, all passing,
covering the full CRUDL contract, both IRI-encoding edge cases above,
error wrapping, and (not skip-safe, unlike the Postgres integration
tests — no external network dependency to be unreachable) real
on-disk persistence across separate repository instances. Full suite:
81 passed, 4 skipped (unrelated live Postgres/Neo4j/Memgraph
integration tests, as before).

`pyoxigraph==0.5.9` is now a real `requirements.txt` dependency, not
POC-only — application code (`shared/repositories/`) imports it now.

**Still not done:** this repository isn't wired into
`resolve_presenter()`/the composition root — no UI feature consumes
it yet, same as `PostgresTripleRepository`. The Railway-volume
persistence question above is also still open — everything here has
been tested against local paths, not the actual
`ai-research-blog-volume`.
