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

## 5. Assessment (high level)

1. **Keep full IRIs at the edges, not necessarily inside the table.** Import, export, the MCP tools, the collaboration items and the UI all keep full IRIs; they are standard and portable. Only the physical table changes.
2. **The change is local.** The store class is the only code that knows the layout, so a dictionary-encoded store can sit behind the same interface. This protects the human's goal that growth in a new direction needs no change to the business or data-access layers.
3. **The scale argument in the notes needs a measurement, not a guess.** The 120k rows are test data across several tenants. The real number to know is rows per active user, which depends on how much history and per-event data the app writes. A relational store with proper indexes handles tens of millions of narrow rows on modest hardware; it struggles when the working set no longer fits in memory, which is exactly the thing integer ids help with. The shared host is the real constraint (a hosted, shared PostgreSQL), so memory and index size matter more than raw row count.
4. **Likely target shape (to be proven by the spike):** a `terms` dictionary (`id bigint identity`, `kind`, `value` plus a hash for lookup, unique) and a narrow `quads` table of four bigints (`g, s, p, o`) with composite indexes led by `g` for tenant scoping, for example `(g, s, p, o)` and `(g, p, o, s)`, plus `(o, ...)` only if reverse lookups prove necessary. Start with two or three permutations, not six (Neptune shows three covers most patterns), and add one only when a real query needs it. Partitioning by graph is a later option, not a first step.
5. **Costs to accept:** writes must resolve terms to ids first (a per-process cache plus an upsert), reads join or look up terms to return IRIs, and backup, restore and the existing tools (`Claude-nquad-tool` export, restore, relabel and grant, the NQuad browser, the seed loader) must understand the new layout. Relabel becomes a dictionary update, which is simpler and cheaper.
6. **Low-cost wins that may not need the full change.** Add a `graph`-leading composite index, drop single-column indexes the composite ones make redundant, check how `left(object, 255)` behaves for long literals, and measure `pg_indexes_size`. These could buy time and are safe to try first.

## 6. Plan (when we pick this up)

Each step is a small verified stage with a stage review; nothing starts until the foundation work is done.

1. **Measure today.** Table and index sizes (`pg_total_relation_size`, `pg_indexes_size`), distinct subjects, predicates and graphs, average term length, and rows per user per activity. Read-only, through the vault, results into this file.
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
