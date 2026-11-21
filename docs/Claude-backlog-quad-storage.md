# Backlog: quad storage, scale and performance

Status: BACKLOG, not started. Filed 2026-11-21 at the human's request. **Must be done before beta** (the human: refactoring after beta data exists is problematic), but only after the current foundational path is finished. It must not distract the work in progress.

Sources: the human's scalability notes (`Y:\Temp\scalability-concerns.txt`, an AI Q&A about storing full IRIs) and ISO 15926 notes (`Y:\Temp\iso-15926.txt`), the W3C RDF 1.2 N-Quads and Concepts drafts, and public research listed at the end. Items marked **(unverified)** came from a search summary or from memory and need a check before anyone relies on them.

## 1. Why this exists (the human's experience, kept short)

The human built tools on an ISO 15926 style semantic data model for a large engineering team. They worked in the lab and failed on real plant data: the store spent its time turning over and barely touched the volume needed. The lessons he carries into this app: (a) quads let data grow in new dimensions (a pump, its facts, and its state over time) with no change to the business or data-access layers, and (b) that freedom is only worth having if the store scales. The aim is to keep (a) and make (b) true before the first outside user.

## 2. What we have today (verified in the code)

- Table `app_n_quads` (the Foundation script names it `n_quads`; the app prefixes it): `id uuid` primary key, `subject text`, `predicate text`, `object text`, `graph text null`, plus `created_at`. Source: `Adventures.Foundation/src/Adventures.Data.NQuad.Postgres/Sql/schema-nquads.sql` and `Store/NpgsqlNQuadStore.cs`.
- Every term is stored as its full text, for example `https://global-webnet.com/id/user/<guid>` (about 73 bytes) in every row that mentions it.
- Indexes: `subject`, `predicate`, `graph`, `(subject, predicate)`, `(predicate, left(object, 255))`, plus the uuid primary key. There is no index that leads with `graph`, although tenancy is carried by the graph.
- Access is behind the store class (`QueryAsync(subject, predicate, object, graph)`, batch insert through `unnest`), and the callers see strings. That seam is what makes the change below possible without touching the business layers.
- The 120,046 rows in the dev database are a few test accounts and four tenants, mostly seed and test data, not one user's production blog. The per-user row count in production is **not measured**, and the scale argument below depends on it.

## 3. What the W3C drafts say (RDF 1.2 N-Quads and Concepts)

The two spec fetches read the start of each page verbatim and got a model summary of the middle, so anything marked unverified needs the page.

- **Verbatim:** N-Quads has no prefix or base mechanism; every IRI is written in full and must be absolute. Namespace prefixes are only a syntax convenience and are not part of the abstract data model; the full IRI is rebuilt from them. Concrete syntaxes may differ in prefixes and IRI references, and that is not significant for meaning. IRIs are global identifiers, not locators. The canonical N-Quads form is one quad per line, with single spaces and LF endings.
- **Unverified (summary):** IRI equality is a plain code-point comparison with no normalization. Literal identity is lexical form plus datatype plus language tag. Skolem IRIs for blank nodes belong under `/.well-known/genid/`.
- **Not found in the text we could read:** any statement that an implementation may store terms internally as integers. The standard does not forbid it either: the abstract model is what must be preserved, and the import and export syntax stays N-Quads with full IRIs. Check section 3.3 and the appendices on the page before quoting this as a fact.

**Answer to "RDF prefixes versus the full IRI in the store":** a prefix (`id:user/...`) is a serialization abbreviation, so storing prefixed strings is not standard and would put fragile logic into every comparison. The standard-compatible way to save space is **dictionary encoding**: keep one row per distinct term (full IRI or literal) in a dictionary table, store compact integers in the quad table, and expand to full IRIs when reading and exporting.

## 4. What the research shows

Each point names its source; the first is the main one.

- **Survey of RDF stores (Hogan et al.):** native stores index quads in B+trees, **six permutations** serve all sixteen quad patterns, Neptune uses three (SPOG, POGS, GSPO) and covers nine of sixteen patterns, and Blazegraph uses six for quads. Dictionary encoding of terms to integers (often 64-bit) is the common approach. Virtuoso's default quad table has five indexes: PSOG, POGS, SP, OP, GS.
- **RDF-3X (Neumann and Weikum):** one big triples table, exhaustive indexes over all permutations and their projections, compressed, and queries answered index-only. The point for us: indexes, not the table, are the store, so their width decides the speed.
- **Hexastore:** six indexes, worst case about five times the index space of a single triples table, in exchange for fast joins. Read this as the cost side of "index everything".
- **Vertical partitioning and property tables (Abadi et al., and the independent re-evaluation in PVLDB):** one table per predicate or wide tables per entity type. Faster for a fixed schema and a known set of predicates, weaker when the predicate is a variable. Our "grow in any direction" goal argues against it as the base layout. It could serve as a read-side cache or materialised view.
- **pg_ripple (a PostgreSQL extension, project documentation, not an independent benchmark):** a PostgreSQL design where each term is hashed (XXH3-128) into a dictionary table and also gets a dense 64-bit identity key used for joins. Useful as a pattern for a lookup-by-hash plus compact join key.
- **Hash versus B-tree dictionary (an older prototype study):** a hash index outperformed a B-tree for dictionary lookup on its dataset, with the warning that it may not generalise. We must measure on our own data.
- **The scalability notes' claim about prefix compression:** the notes say PostgreSQL B-tree indexes compress a repeated URL prefix. **(unverified, and I believe it is wrong)** PostgreSQL B-tree has duplicate-key deduplication (since version 13) and suffix truncation in upper index pages, but no general prefix compression of leaf entries. Check the PostgreSQL documentation and measure with `pg_relation_size` before relying on it either way. If it is wrong, full IRIs cost more per index entry than the notes assume.
- **Gap:** the searches found no independent PostgreSQL-specific benchmark of quad layouts. The decision therefore needs our own measurement (section 6, step 1).

Sources: [Survey of RDF Stores and SPARQL Engines (arXiv 2102.13027)](https://arxiv.org/pdf/2102.13027) · [Storage, Indexing, Query Processing and Benchmarking in RDF Engines (arXiv 2009.10331)](https://arxiv.org/pdf/2009.10331) · [A Survey of RDF Data Management Systems (arXiv 1601.00707)](https://arxiv.org/pdf/1601.00707) · [RDF-3X paper](https://cs.uwaterloo.ca/~gweddell/cs848/papers/RDF-3X.pdf) · [Hexastore paper](https://cs.uwaterloo.ca/%7Egweddell/cs848/papers/Hexastore.pdf) · [Abadi et al. re-evaluation, PVLDB](https://www.doi.org/10.14778/1454159.1454227) · [pg_ripple architecture](https://grove.github.io/pg-ripple/operations/architecture.html) · [W3C RDF 1.2 N-Quads](https://www.w3.org/TR/rdf12-n-quads/) · [W3C RDF 1.2 Concepts](https://www.w3.org/TR/rdf12-concepts/). The search tool returned snippets, not full texts, so figures such as the five-fold index cost are as reported by those snippets.

## 4a. Measurements (2026-11-21, read-only SELECTs on the live store through the vault)

| What | Value |
|---|---|
| Whole database (the hosting panel's 8.53% of a 1000 MB quota) | 85.4 MB |
| `app_n_quads` rows | 120,058 |
| `app_n_quads` table / its indexes | 32.7 MB / 37.3 MB (70 MB together, about **611 bytes per quad**: 272 table, 311 indexes) |
| Average length in characters: subject / predicate / object / graph | 72 / 50 / 51 / 40 |
| Distinct subjects / predicates / objects / graphs | 14,606 / 198 / 8,516 / 11 |
| Quads per subject | about 8 |
| Largest indexes | `(subject, predicate)` 24.3 MB, primary key 4.7 MB, `(predicate, left(object,255))` 3.5 MB, `subject` 3.0 MB, `predicate` 1.0 MB, `graph` 0.8 MB |
| Other tables | `app_media` 3.1 MB; the old `n_quads` table and the legacy `entities` tables are under 0.3 MB |

What this says:

- **The binding limit for beta is the 1000 MB quota, not query speed.** At 611 bytes per quad, the 915 MB of headroom holds about 1.5 million more quads at today's layout. Everything depends on quads per beta user, which is still unmeasured: 2,000 quads a user is roughly 750 users, but 120,000 a user (the figure in the scalability notes) is about 12.
- **Predicates are only 198 distinct strings of about 50 characters, repeated across 120,000 rows.** Subjects average 8 quads each. Both are what a dictionary removes.
- **Estimated dictionary layout (a rough estimate, not measured):** 56 to 72 bytes a row plus two or three narrow indexes of about 40 bytes an entry each gives about 170 to 190 bytes per quad, so about **3 times smaller** (70 MB would be about 22 MB plus about 3 MB of dictionary for roughly 23,000 distinct terms). The spike in step 3 must confirm it.
- **Cheap wins, measured:** `ix_app_n_quads_subject` (3.0 MB) is covered by the `(subject, predicate)` index, and `ix_app_n_quads_predicate` (1.0 MB) by `(predicate, object)`; dropping both saves about 4 MB with no loss. `ix_app_n_quads_subject` is 3 MB against 24 MB for the composite although both hold all rows, which fits duplicate-key deduplication; it does not prove prefix compression of long strings.

## 4b. The human's proposal and the options (2026-11-21)

The human's view: the team must not let patterns and standards block the obvious improvement (the ISO 15926 tools became unusable through templates and SPARQL; the way out was to strip them and keep it simple, with no SPARQL). The proposal: a small **mapping table** of namespace prefixes and a short local id (`usr:` for `https://global-webnet.com/id/user/`, `1` for a person's GUID); the data table stores `usr:1`, not the full address; at sign-in take the person's short id and use it throughout; an export for an outside triple store is generated from the mapping when ever needed.

Assessment:

- **Agreed:** no SPARQL, only the four access patterns the store already has; full IRIs generated on export. The W3C text allows this as long as the abbreviation stays inside the store and is expanded wherever an IRI is expected (Concepts, 1.4); that is the same reason the export must expand every term.
- **The idea is a two-level dictionary.** The prefix registry is one table of a few dozen rows; the local id (`1`) is a second table mapping a number to the original GUID. Storing the GUID once in the mapping is what makes the export possible, and it is exactly the dictionary I recommended. The quad table then holds only numbers.
- **Where I would adjust it (to be decided in the spike):**
  1. **Do not use a bare sequential number as the identity outside the store.** The GUID stays the identity in tokens, links, seeds, post bodies and the MCP tools, because a number is allocated per database: dev and live would give the same person different numbers, and seed files, tenant moves, imports and restores all carry GUIDs. The number is an internal handle that the store resolves (a per-process cache makes it cheap), so nothing above the store changes.
  2. **The prefix registry must be fixed.** A prefix whose base address changes later is a migration of every row, so registered prefixes are append-only and carry a version; an IRI with no registered prefix is stored whole (schema.org, other domains).
  3. **A literal with long text (a post body) stays out of the dictionary.**

| Option | Per quad | Reads | Keeps the layers untouched | Notes |
|---|---|---|---|---|
| Today: full text | about 611 bytes | direct | yes | simplest, quota fills first |
| A. Prefix plus GUID as text (`usr:c70b...`) | about 450 | direct, expand at the edge | yes | small gain, no id allocation, but still wide text indexes |
| B. Prefix registry plus native uuid in a typed column | about 350 | direct | yes | no allocation; the quad table has several column types |
| C. Full dictionary, one bigint per term, namespaces as a dictionary column (the human's idea made uniform) | about 170 to 190 (estimated) | one cached lookup | yes, if kept inside the store | best size and speed; most work; export is a join |

Sizes for A and B are my estimates from the measured averages. Recommendation unchanged: measure per-user quads, try the cheap index wins now if wanted, and spike C against B before deciding.

## 5. Assessment (high level)

1. **Keep full IRIs at the edges, not necessarily inside the table.** Import, export, the MCP tools, the collaboration items and the UI all keep full IRIs; they are standard and portable. Only the physical table changes.
2. **The change is local.** The store class is the only code that knows the layout, so a dictionary-encoded store can sit behind the same interface. This protects the human's goal that growth in a new direction needs no change to the business or data-access layers.
3. **The scale argument in the notes needs a measurement, not a guess.** The 120k rows are test data across several tenants. The real number to know is rows per active user, which depends on how much history and per-event data the app writes. A relational store with proper indexes handles tens of millions of narrow rows on modest hardware; it struggles when the working set no longer fits in memory, which is exactly the thing integer ids help with. The shared host is the real constraint (a hosted, shared PostgreSQL), so memory and index size matter more than raw row count.
4. **Likely target shape (to be proven by the spike):** a `terms` dictionary (`id bigint identity`, `kind`, `value` plus a hash for lookup, unique) and a narrow `quads` table of four bigints (`g, s, p, o`) with composite indexes led by `g` for tenant scoping, for example `(g, s, p, o)` and `(g, p, o, s)`, plus `(o, ...)` only if reverse lookups prove necessary. Start with two or three permutations, not six (Neptune shows three covers most patterns), and add one only when a real query needs it. Partitioning by graph is a later option, not a first step.
5. **Costs to accept:** writes must resolve terms to ids first (a per-process cache plus an upsert), reads join or look up terms to return IRIs, and backup, restore and the existing tools (`Claude-nquad-tool` export, restore, relabel and grant, the NQuad browser, the seed loader) must understand the new layout. Relabel becomes a dictionary update, which is simpler and cheaper.
6. **Low-cost wins that may not need the full change.** Add a `graph`-leading composite index, drop single-column indexes the composite ones make redundant, check how `left(object, 255)` behaves for long literals, and measure `pg_indexes_size`. These could buy time and are safe to try first.

## 6. Plan (when we pick this up)

Each step is a small verified stage with a stage review; nothing starts until the foundation work is done.

1. **Measure today.** Sizes, distinct counts and term lengths are DONE (section 4a, 2026-11-21). Still to measure: quads per user and per post (and what a "state over time" quad stream would add), through the same read-only vault route.
2. **Define the workload.** List the real query shapes from the store class and the app (by subject, by subject and predicate, by predicate and object, by graph, tenant relabel, export) and the expected growth per user, then set a target (rows, users, p95 latency) so "scalable" means a number.
3. **Spike on a scratch database.** Build the dictionary plus narrow quad layout, load a synthetic dataset scaled to the target (and a copy of the current data), compare against today's table on the shapes from step 2, and test hash versus B-tree for the dictionary lookup. Include 64-bit hash collision handling in the design.
4. **Decide.** Record the decision in a `Claude-decision-2026-11-quad-storage.md` file with the numbers; update the architecture reference.
5. **Implement behind the store interface** with tests first: the existing store tests run against both layouts, N-Quads import and export round trip, tenant isolation unchanged.
6. **Migrate.** Backup with `Claude-nquad-tool export` (verified), build the new tables alongside, copy and verify counts and a sample of quads, switch, keep the old table for a release, then drop it. Update `Claude-nquad-tool`, the NQuad browser and the seed process.
7. **Re-measure** against the step 2 target and record the result.

## 7. Open questions for the human

- What growth should we design for at beta: users, blogs per user, and events per day? A number, even a rough one, decides how far to go.
- The graph column carries tenancy today. Should a blog or a user also get its own graph so a partition by graph maps to one blog?
- Is a literal's full text expected in the dictionary (large post bodies stay as text in a separate column or table, not in the dictionary)? I would keep long literals out of the dictionary.

## 8. Added by the human (2026-11-21): the schema site, our own benchmarks, pristine beta data

1. **`schema.global-webnet.com` is a critical part of beta.** It is the one place where a developer sees schemas, tables, types and people at a glance. It is **navigated, not hardcoded**: parent and children like folders on a disk, built from the data, so dimensions of the data nobody has thought of yet show up without code changes. The NQuad browser (stage S8) is the starting point. This changes an earlier call: leaving its certificate until after beta (2026-11-19) no longer holds, because the host needs a working HTTPS certificate before beta (see the AGENTS Remaining note: the free quota is used, so the options are importing our own certificate or buying one).
2. **We run our own benchmarks.** No published study replaces measuring our layout on our host. Design (to be refined in step 2 and 3 of the plan):
   - **A generator** (a repeatable script or test tool) seeds a scratch database for N users, each with blogs, posts, comments, tags, role assignments, and later a stream of state-over-time quads; parameters are users, blogs per user, posts per blog, comments per post, and events per day.
   - **Where it runs:** never in the live store. First on the local Postgres, then on a **second hosted database on the same SmarterASP plan** (the panel shows 1 of 20 databases used), because the shared host's memory and quota are the real constraints, not our workstation.
   - **What it measures:** bytes per user (gives users per 1000 MB quota), insert rate, and p50 and p95 for the real query shapes (sign-in, post list, post by address, admin grids, schema browser drill-down, tenant relabel, export) at 100, 1,000 and 10,000 users, for each layout side by side.
   - **Result:** maximum beta users = the smaller of quota divided by bytes per user and the number where p95 crosses the target set in step 2. Recorded in a decision file with the raw numbers.
3. **Beta data must be pristine.** Today dev, test and live share one database (`db_a2cb58_aiblogdv`, local runs included), so it holds test people, test content and tenants from the build. Before beta: finish the storage layout change first (migrating encoded data later is harder), then build a clean beta store from the numbered seeds only, with no test accounts, and keep benchmarks and development on their own databases. The cutover is a rehearsed script (build, verify counts, switch), with the verified export from `Claude-nquad-tool` as the safety net.

Order of this work (all after the current foundation path, all before beta): measure per-user quads, benchmark generator and spike on a scratch database, decide and implement the layout, schema site and certificate, clean beta store, then the beta data freeze.
